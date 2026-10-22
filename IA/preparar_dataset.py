"""
Prepara el dataset Drinking Waste para detección de objetos con Ultralytics YOLO.

Asocia cada imagen con su archivo .txt por nombre base, conserva todas las cajas
(incluidas las imágenes mix) y reparte los pares en train/val/test.

Uso desde la raíz del proyecto:
  python preparar_dataset.py --simular
  python preparar_dataset.py

El resultado se guarda por defecto en dataset_detect/ y contiene data.yaml.
"""
import argparse
import json
import math
import random
import shutil
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

EXTENSIONES = {".jpg", ".jpeg", ".png", ".webp"}
NOMBRES_CLASES = {
    0: "AluCan",
    1: "Glass",
    2: "HDPEM",
    3: "PET",
}


@dataclass(frozen=True)
class ParImagenEtiqueta:
    imagen: Path
    etiqueta: Path
    clases: tuple[int, ...]


def leer_etiqueta(ruta: Path) -> tuple[int, ...]:
    """Valida el formato YOLO y devuelve los IDs de clase de todas las cajas."""
    ids: list[int] = []
    for numero_linea, linea in enumerate(ruta.read_text(encoding="utf-8-sig").splitlines(), 1):
        partes = linea.split()
        if not partes:
            continue
        if len(partes) != 5:
            raise ValueError(
                f"{ruta}:{numero_linea}: se esperaban 5 valores YOLO; se encontraron {len(partes)}."
            )
        try:
            clase_float = float(partes[0])
            coordenadas = [float(valor) for valor in partes[1:]]
        except ValueError as error:
            raise ValueError(f"{ruta}:{numero_linea}: hay un valor no numérico.") from error

        if not math.isfinite(clase_float) or not clase_float.is_integer():
            raise ValueError(f"{ruta}:{numero_linea}: el ID de clase debe ser un entero.")
        clase = int(clase_float)
        if clase not in NOMBRES_CLASES:
            raise ValueError(
                f"{ruta}:{numero_linea}: ID {clase} fuera del mapa "
                f"{sorted(NOMBRES_CLASES)}."
            )
        if not all(math.isfinite(valor) for valor in coordenadas):
            raise ValueError(f"{ruta}:{numero_linea}: las coordenadas deben ser finitas.")

        x_centro, y_centro, ancho, alto = coordenadas
        if not (0 <= x_centro <= 1 and 0 <= y_centro <= 1):
            raise ValueError(f"{ruta}:{numero_linea}: centro fuera del rango normalizado [0, 1].")
        if not (0 < ancho <= 1 and 0 < alto <= 1):
            raise ValueError(f"{ruta}:{numero_linea}: ancho y alto deben estar en (0, 1].")
        ids.append(clase)
    return tuple(ids)


def encontrar_pares(origen: Path) -> tuple[list[ParImagenEtiqueta], Counter, list[str]]:
    """Relaciona imágenes y anotaciones por nombre base sin asumir carpetas por clase."""
    imagenes_por_nombre: dict[str, Path] = {}
    etiquetas_por_nombre: dict[str, Path] = {}
    for ruta in origen.iterdir():
        if not ruta.is_file():
            continue
        if ruta.suffix.lower() in EXTENSIONES:
            clave = ruta.stem.casefold()
            if clave in imagenes_por_nombre:
                raise ValueError(f"Hay más de una imagen con el mismo nombre base: {ruta.stem}")
            imagenes_por_nombre[clave] = ruta
        elif ruta.suffix.lower() == ".txt":
            clave = ruta.stem.casefold()
            if clave in etiquetas_por_nombre:
                raise ValueError(f"Hay más de una etiqueta con el mismo nombre base: {ruta.stem}")
            etiquetas_por_nombre[clave] = ruta

    estadisticas: Counter = Counter()
    pares: list[ParImagenEtiqueta] = []
    errores: list[str] = []
    for clave, imagen in sorted(imagenes_por_nombre.items()):
        etiqueta = etiquetas_por_nombre.get(clave)
        if etiqueta is None:
            estadisticas["imagenes_sin_etiqueta"] += 1
            continue
        try:
            clases = leer_etiqueta(etiqueta)
        except ValueError as error:
            estadisticas["etiquetas_invalidas"] += 1
            errores.append(str(error))
            continue
        pares.append(ParImagenEtiqueta(imagen, etiqueta, clases))
        estadisticas["imagenes_con_par"] += 1
        if not clases:
            estadisticas["imagenes_sin_objetos"] += 1

    estadisticas["etiquetas_sin_imagen"] = len(set(etiquetas_por_nombre) - set(imagenes_por_nombre))
    return pares, estadisticas, errores


def repartir(
    pares: list[ParImagenEtiqueta],
    semilla: int,
    proporcion_train: float,
    proporcion_val: float,
) -> dict[str, list[ParImagenEtiqueta]]:
    barajados = pares[:]
    random.Random(semilla).shuffle(barajados)
    cantidad_train = int(len(barajados) * proporcion_train)
    cantidad_val = int(len(barajados) * proporcion_val)
    return {
        "train": barajados[:cantidad_train],
        "val": barajados[cantidad_train:cantidad_train + cantidad_val],
        "test": barajados[cantidad_train + cantidad_val:],
    }


def escribir_yaml(destino: Path) -> None:
    ruta_dataset = json.dumps(str(destino.resolve()), ensure_ascii=False)
    lineas = [
        f"path: {ruta_dataset}",
        "train: images/train",
        "val: images/val",
        "test: images/test",
        "names:",
    ]
    lineas.extend(f"  {identificador}: {nombre}" for identificador, nombre in NOMBRES_CLASES.items())
    (destino / "data.yaml").write_text("\n".join(lineas) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument(
        "--origen",
        type=Path,
        default=Path("drinking-waste-classification/Images_of_Waste/YOLO_imgs"),
        help="Carpeta que contiene las imágenes y sus .txt YOLO.",
    )
    parser.add_argument(
        "--salida",
        type=Path,
        default=Path("dataset_detect"),
        help="Carpeta de salida (debe no existir o estar vacía).",
    )
    parser.add_argument("--train", type=float, default=0.70, help="Proporción para entrenamiento.")
    parser.add_argument("--val", type=float, default=0.15, help="Proporción para validación.")
    parser.add_argument("--semilla", type=int, default=42, help="Semilla para reparto reproducible.")
    parser.add_argument("--simular", action="store_true", help="Valida y muestra conteos sin copiar archivos.")
    args = parser.parse_args()

    origen = args.origen.resolve()
    salida = args.salida.resolve()
    if not origen.is_dir():
        raise SystemExit(f"No existe la carpeta de origen: {origen}")
    if args.train <= 0 or args.val < 0 or args.train + args.val >= 1:
        raise SystemExit("--train debe ser > 0, --val >= 0 y la suma debe ser menor que 1.")
    if not args.simular and salida.exists() and any(salida.iterdir()):
        raise SystemExit(f"La carpeta de salida no está vacía: {salida}")

    pares, estadisticas, errores = encontrar_pares(origen)
    print(f"Origen: {origen}")
    print(
        f"Emparejadas válidas: {len(pares)}; etiquetas inválidas: "
        f"{estadisticas['etiquetas_invalidas']}."
    )
    if errores:
        print("Errores de anotación (máximo 20 mostrados):")
        for error in errores[:20]:
            print(f"  - {error}")
        if len(errores) > 20:
            print(f"  ... y {len(errores) - 20} errores más.")
        if not args.simular:
            raise SystemExit("Corrige las etiquetas inválidas antes de generar el dataset.")
    if not pares:
        raise SystemExit("No se encontraron imágenes con una etiqueta .txt correspondiente.")
    particiones = repartir(pares, args.semilla, args.train, args.val)

    print(f"Imágenes con etiqueta: {len(pares)}")
    print(f"Imágenes sin objetos anotados (etiqueta vacía): {estadisticas['imagenes_sin_objetos']}")
    print("Partición | imágenes | cajas AluCan | Glass | HDPEM | PET | sin objetos")
    for nombre, lista in particiones.items():
        conteos = Counter(clase for par in lista for clase in par.clases)
        vacias = sum(not par.clases for par in lista)
        print(
            f"{nombre:<9} | {len(lista):>8} | {conteos[0]:>6} | {conteos[1]:>5} | "
            f"{conteos[2]:>5} | {conteos[3]:>3} | {vacias:>11}"
        )
    print(
        "No emparejadas: "
        f"{estadisticas['imagenes_sin_etiqueta']} imágenes sin .txt, "
        f"{estadisticas['etiquetas_sin_imagen']} .txt sin imagen."
    )

    if args.simular:
        print("Simulación: no se copiaron archivos.")
        return

    for particion, lista in particiones.items():
        carpeta_imagenes = salida / "images" / particion
        carpeta_etiquetas = salida / "labels" / particion
        carpeta_imagenes.mkdir(parents=True, exist_ok=True)
        carpeta_etiquetas.mkdir(parents=True, exist_ok=True)
        for par in lista:
            shutil.copy2(par.imagen, carpeta_imagenes / par.imagen.name)
            shutil.copy2(par.etiqueta, carpeta_etiquetas / f"{par.imagen.stem}.txt")

    escribir_yaml(salida)
    print(f"Dataset de detección listo en: {salida}")
    print(f"Configuración YOLO: {salida / 'data.yaml'}")


if __name__ == "__main__":
    main()
