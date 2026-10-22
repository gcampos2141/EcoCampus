"""
EcoCampus - Módulo de validación de evidencias fotográficas.
Cubre RF-003 (detección), RNF-002 (pHash anti-duplicados) y RNF-003 (< 3 s).

Flujo: carga segura -> control de calidad -> pHash anti-duplicados
       -> detección YOLO -> decisión en tres estados.
"""
from __future__ import annotations

import io
import json
import os
import sys
import time
from typing import Iterable
from pathlib import Path

import cv2
import imagehash
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

RAIZ_PROYECTO = Path(__file__).resolve().parent
RUTA_MODELO = os.getenv(
    "ECOCAMPUS_MODELO",
    str(RAIZ_PROYECTO / "models" / "best_detection.pt"),
)

# --- Parámetros de decisión: calibrar con fotos reales ---------------------
UMBRAL_ACEPTAR = 0.80       # inicial y conservador; calibrar antes de producción
UMBRAL_RECHAZAR = 0.60      # confianza para rechazar si solo detecta otras clases
UMBRAL_DETECCION = 0.25     # mínimo para incluir una caja en resultados
TAMANO_INFERENCIA = 640
NITIDEZ_MINIMA = 60.0       # varianza del Laplaciano (menor = más borrosa)
BRILLO_MINIMO = 40.0        # escala 0-255
BRILLO_MAXIMO = 220.0
DISTANCIA_HAMMING_MAX = 6   # <= 6 de 64 bits equivale a >= 90 % de similitud
TAMANO_MAX_BYTES = 8 * 1024 * 1024
LADO_MAX_PX = 1280
CLASES_RECOMPENSABLES = {"ALUCAN", "PET"}


class ImagenInvalida(ValueError):
    """El archivo recibido no es una imagen utilizable (el API responde 400)."""


# --- 1. Carga segura ---------------------------------------------------------
def cargar_imagen(datos: bytes) -> Image.Image:
    """Valida tamaño y formato, corrige la orientación EXIF y limita la resolución."""
    if not datos or len(datos) > TAMANO_MAX_BYTES:
        raise ImagenInvalida("Tamaño de archivo inválido.")
    try:
        with Image.open(io.BytesIO(datos)) as original:
            original.load()
            imagen = ImageOps.exif_transpose(original).convert("RGB")
    except (UnidentifiedImageError, OSError) as error:
        raise ImagenInvalida("El archivo no es una imagen reconocida.") from error
    imagen.thumbnail((LADO_MAX_PX, LADO_MAX_PX))
    return imagen


# --- 2. Control de calidad ---------------------------------------------------
def evaluar_calidad(imagen: Image.Image) -> dict:
    """Descarta fotos borrosas, oscuras o sobreexpuestas antes de gastar inferencia."""
    gris = cv2.cvtColor(np.asarray(imagen), cv2.COLOR_RGB2GRAY)
    nitidez = float(cv2.Laplacian(gris, cv2.CV_64F).var())
    brillo = float(gris.mean())

    motivo = None
    if nitidez < NITIDEZ_MINIMA:
        motivo = "La imagen está borrosa. Sostén firme el teléfono y enfoca el envase."
    elif brillo < BRILLO_MINIMO:
        motivo = "La imagen está muy oscura. Busca más luz."
    elif brillo > BRILLO_MAXIMO:
        motivo = "La imagen está sobreexpuesta. Evita reflejos y luz directa."

    return {
        "nitidez": round(nitidez, 1),
        "brillo": round(brillo, 1),
        "apta": motivo is None,
        "motivo": motivo,
    }


# --- 3. Anti-duplicados (pHash) ---------------------------------------------
def calcular_phash(imagen: Image.Image) -> str:
    """Hash perceptual de 64 bits (16 caracteres hexadecimales)."""
    return str(imagehash.phash(imagen))


def buscar_duplicado(hash_nuevo: str, hashes_previos: Iterable[str]) -> tuple[bool, int | None]:
    """Devuelve (es_duplicado, distancia_minima) comparando por distancia de Hamming."""
    nuevo = imagehash.hex_to_hash(hash_nuevo)
    minima = None
    for previo in hashes_previos:
        distancia = int(nuevo - imagehash.hex_to_hash(previo))
        if minima is None or distancia < minima:
            minima = distancia
    return (minima is not None and minima <= DISTANCIA_HAMMING_MAX), minima


# --- 4. Detección y decisión -------------------------------------------------
def decidir_detecciones(detecciones: list[dict], tamano: tuple[int, int]) -> dict:
    """Decide si alguna caja corresponde a un objeto recompensable."""
    ancho, alto = tamano
    aceptables = [
        deteccion for deteccion in detecciones
        if deteccion["clase_id"] in (0, 3)
        and deteccion["confianza"] >= UMBRAL_ACEPTAR
    ]
    if aceptables:
        seleccionada = max(aceptables, key=lambda deteccion: deteccion["confianza"])
        material = seleccionada["material"]
        estado = "ACEPTADO"
        mensaje = f"{material} detectado. Evidencia validada."
    else:
        candidatas_validas = [
            deteccion for deteccion in detecciones
            if deteccion["clase_id"] in (0, 3)
        ]
        otras_clases = [
            deteccion for deteccion in detecciones
            if deteccion["clase_id"] not in (0, 3)
            and deteccion["confianza"] >= UMBRAL_RECHAZAR
        ]
        if candidatas_validas:
            seleccionada = max(candidatas_validas, key=lambda deteccion: deteccion["confianza"])
            material = seleccionada["material"]
            estado = "REINTENTAR"
            mensaje = "Detectamos un posible envase válido, pero con poca confianza. Acércalo y vuelve a intentarlo."
        elif otras_clases:
            seleccionada = max(otras_clases, key=lambda deteccion: deteccion["confianza"])
            material = seleccionada["clase"]
            estado = "RECHAZADO"
            mensaje = "El objeto detectado no corresponde a una lata de aluminio ni a una botella PET."
        else:
            seleccionada = None
            material = "INDETERMINADO"
            estado = "REINTENTAR"
            mensaje = "No encontramos una lata o botella PET con suficiente claridad. Centra el objeto y vuelve a intentarlo."

    cajas = []
    for deteccion in detecciones:
        x1, y1, x2, y2 = deteccion["caja"]
        cajas.append({
            "clase": deteccion["clase"],
            "material": deteccion["material"],
            "confianza": round(deteccion["confianza"], 4),
            "caja": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            "caja_normalizada": [
                round(x1 / ancho, 6),
                round(y1 / alto, 6),
                round(x2 / ancho, 6),
                round(y2 / alto, 6),
            ],
        })

    return {
        "estado": estado,
        "material": material,
        "confianza": round(seleccionada["confianza"], 4) if seleccionada else 0.0,
        "mensaje": mensaje,
        "detecciones": cajas,
        "tamano_imagen": {"ancho": ancho, "alto": alto},
    }


class ClasificadorResiduos:
    """Envuelve el detector YOLO. Instanciar una sola vez al iniciar el servicio."""

    def __init__(self, ruta_modelo: str = RUTA_MODELO):
        from ultralytics import YOLO  # import diferido: facilita pruebas sin el modelo

        if not Path(ruta_modelo).is_file():
            raise FileNotFoundError(f"No se encontró el modelo de detección: {ruta_modelo}")
        self.modelo = YOLO(ruta_modelo, task="detect")
        self.nombres = {int(i): nombre.upper() for i, nombre in self.modelo.names.items()}
        requeridas = {"ALUCAN", "GLASS", "HDPEM", "PET"}
        if not requeridas <= set(self.nombres.values()):
            raise ValueError(
                f"El modelo no contiene las clases esperadas {sorted(requeridas)}: "
                f"{self.nombres}"
            )
        self.modelo.predict(
            Image.new("RGB", (TAMANO_INFERENCIA, TAMANO_INFERENCIA)),
            imgsz=TAMANO_INFERENCIA,
            verbose=False,
        )

    def clasificar(self, imagen: Image.Image) -> dict:
        resultado = self.modelo.predict(
            imagen,
            imgsz=TAMANO_INFERENCIA,
            conf=UMBRAL_DETECCION,
            verbose=False,
        )[0]
        detecciones = []
        if resultado.boxes is not None:
            for caja in resultado.boxes:
                clase_id = int(caja.cls.item())
                confianza = float(caja.conf.item())
                x1, y1, x2, y2 = caja.xyxy[0].cpu().tolist()
                nombre = self.nombres[clase_id]
                detecciones.append({
                    "clase_id": clase_id,
                    "clase": nombre,
                    "material": "ALUMINIO" if nombre == "ALUCAN" else nombre,
                    "confianza": confianza,
                    "caja": (x1, y1, x2, y2),
                })
        detecciones.sort(key=lambda deteccion: deteccion["confianza"], reverse=True)
        return decidir_detecciones(detecciones, imagen.size)


_clasificador: ClasificadorResiduos | None = None


def obtener_clasificador() -> ClasificadorResiduos:
    global _clasificador
    if _clasificador is None:
        _clasificador = ClasificadorResiduos()
    return _clasificador


# --- 5. Orquestación ---------------------------------------------------------
def procesar_evidencia(datos: bytes, hashes_previos: Iterable[str] = ()) -> dict:
    """
    Punto de entrada para el backend.
    `hashes_previos`: pHash recientes consultados en la BD (p. ej. últimos 7 días).
    """
    inicio = time.perf_counter()
    imagen = cargar_imagen(datos)
    hash_foto = calcular_phash(imagen)
    calidad = evaluar_calidad(imagen)

    if not calidad["apta"]:
        resultado = {"estado": "REINTENTAR", "material": "INDETERMINADO",
                     "mensaje": calidad["motivo"]}
    else:
        duplicado, distancia = buscar_duplicado(hash_foto, hashes_previos)
        if duplicado:
            resultado = {"estado": "RECHAZADO", "material": "INDETERMINADO",
                         "mensaje": "Esta fotografía ya fue registrada.",
                         "distancia_hamming": distancia}
        else:
            resultado = obtener_clasificador().clasificar(imagen)

    resultado.update({
        "phash": hash_foto,
        "calidad": calidad,
        "tiempo_ms": round((time.perf_counter() - inicio) * 1000),
    })
    return resultado


if __name__ == "__main__":
    ruta = sys.argv[1] if len(sys.argv) > 1 else "images.jpg"
    try:
        with open(ruta, "rb") as archivo:
            print(json.dumps(procesar_evidencia(archivo.read()), indent=2, ensure_ascii=False))
    except FileNotFoundError:
        print(f"No se encontró '{ruta}'. Uso: python clasificador.py <imagen>")
    except ImagenInvalida as error:
        print(f"Imagen inválida: {error}")
