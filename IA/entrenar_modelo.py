"""
Entrena y evalúa un detector YOLO para AluCan, Glass, HDPEM y PET.

Uso desde la raíz del proyecto:
  python entrenar_modelo.py
  python entrenar_modelo.py --epochs 80 --batch 4
  python entrenar_modelo.py --export-onnx

El mejor checkpoint se guarda como models/best_detection.pt. El test se evalúa
al final y no se utiliza para seleccionar épocas ni ajustar hiperparámetros.
"""
import argparse
import shutil
from pathlib import Path

from ultralytics import YOLO

RAIZ_PROYECTO = Path(__file__).resolve().parent
EXTENSIONES_IMAGEN = {".jpg", ".jpeg", ".png", ".webp"}


def validar_dataset(ruta_yaml: Path) -> None:
    """Comprueba que existan las tres particiones y sus pares imagen-etiqueta."""
    if not ruta_yaml.is_file():
        raise SystemExit(f"No existe el archivo de configuración del dataset: {ruta_yaml}")

    raiz_dataset = ruta_yaml.parent
    for particion in ("train", "val", "test"):
        carpeta_imagenes = raiz_dataset / "images" / particion
        carpeta_etiquetas = raiz_dataset / "labels" / particion
        if not carpeta_imagenes.is_dir() or not carpeta_etiquetas.is_dir():
            raise SystemExit(
                f"Falta la carpeta images/{particion} o labels/{particion} en {raiz_dataset}."
            )

        imagenes = {
            ruta.stem.casefold()
            for ruta in carpeta_imagenes.iterdir()
            if ruta.is_file() and ruta.suffix.lower() in EXTENSIONES_IMAGEN
        }
        etiquetas = {
            ruta.stem.casefold()
            for ruta in carpeta_etiquetas.iterdir()
            if ruta.is_file() and ruta.suffix.lower() == ".txt"
        }
        if not imagenes:
            raise SystemExit(f"No hay imágenes en {carpeta_imagenes}.")
        if imagenes != etiquetas:
            faltan_etiquetas = sorted(imagenes - etiquetas)
            faltan_imagenes = sorted(etiquetas - imagenes)
            raise SystemExit(
                f"Los pares imagen/etiqueta no coinciden en {particion}. "
                f"Sin .txt: {faltan_etiquetas[:5]}; sin imagen: {faltan_imagenes[:5]}."
            )
        print(f"{particion}: {len(imagenes)} pares imagen/etiqueta")


def argumentos() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument(
        "--data",
        type=Path,
        default=RAIZ_PROYECTO / "dataset_detect" / "data.yaml",
        help="YAML del dataset de detección.",
    )
    parser.add_argument(
        "--modelo",
        default="yolov8n.pt",
        help="Pesos preentrenados de detección (por defecto: yolov8n.pt).",
    )
    parser.add_argument("--epochs", type=int, default=60, help="Máximo de épocas.")
    parser.add_argument("--imgsz", type=int, default=640, help="Tamaño de imagen.")
    parser.add_argument(
        "--batch",
        type=int,
        default=-1,
        help="Lote; -1 deja que Ultralytics lo ajuste automáticamente según la GPU.",
    )
    parser.add_argument(
        "--device",
        default=None,
        help="Dispositivo, por ejemplo 0 para la primera GPU o cpu. Por defecto, selección automática.",
    )
    parser.add_argument("--workers", type=int, default=2, help="Procesos de carga de datos.")
    parser.add_argument("--patience", type=int, default=12, help="Early stopping sobre validación.")
    parser.add_argument(
        "--nombre",
        default="ecocampus_detect",
        help="Nombre del directorio de esta ejecución bajo runs/detect.",
    )
    parser.add_argument(
        "--salida-pesos",
        type=Path,
        default=RAIZ_PROYECTO / "models" / "best_detection.pt",
        help="Ruta para copiar el mejor checkpoint, sin sobrescribir models/best.pt.",
    )
    parser.add_argument(
        "--export-onnx",
        action="store_true",
        help="Exporta el mejor detector a ONNX después de evaluarlo.",
    )
    return parser.parse_args()


def entrenar() -> None:
    args = argumentos()
    ruta_yaml = args.data.resolve()
    validar_dataset(ruta_yaml)

    print(f"Dataset: {ruta_yaml}")
    print(f"Modelo inicial: {args.modelo}")
    print(f"Entrenamiento: epochs={args.epochs}, imgsz={args.imgsz}, batch={args.batch}")

    modelo = YOLO(args.modelo)
    parametros = {
        "data": str(ruta_yaml),
        "epochs": args.epochs,
        "imgsz": args.imgsz,
        "batch": args.batch,
        "patience": args.patience,
        "project": str(RAIZ_PROYECTO / "runs" / "detect"),
        "name": args.nombre,
        "exist_ok": False,
        "workers": args.workers,
        "seed": 42,
        "deterministic": True,
        "pretrained": True,
        "plots": True,
        "hsv_h": 0.015,
        "hsv_s": 0.7,
        "hsv_v": 0.4,
        "degrees": 10.0,
        "translate": 0.1,
        "scale": 0.5,
        "fliplr": 0.5,
        "flipud": 0.0,
        "mosaic": 1.0,
        "mixup": 0.0,
        "close_mosaic": 10,
        "amp": True,
    }
    if args.device is not None:
        parametros["device"] = args.device

    modelo.train(**parametros)

    ruta_mejor = Path(modelo.trainer.best)
    if not ruta_mejor.is_file():
        raise FileNotFoundError(f"No se encontró el mejor checkpoint del entrenamiento: {ruta_mejor}")

    print(f"\nEvaluando el mejor checkpoint en test: {ruta_mejor}")
    mejor_modelo = YOLO(str(ruta_mejor))
    batch_validacion = min(args.batch, 4) if args.batch > 0 else 4
    parametros_validacion = {
        "data": str(ruta_yaml),
        "split": "test",
        "imgsz": args.imgsz,
        "batch": batch_validacion,
        "workers": args.workers,
        "plots": True,
        "project": str(RAIZ_PROYECTO / "runs" / "detect"),
        "name": f"{args.nombre}_test",
        "exist_ok": True,
    }
    if args.device is not None:
        parametros_validacion["device"] = args.device
    metricas = mejor_modelo.val(**parametros_validacion)
    print(f"Precisión (P): {metricas.box.mp:.4f}")
    print(f"Recall (R):    {metricas.box.mr:.4f}")
    print(f"mAP50:         {metricas.box.map50:.4f}")
    print(f"mAP50-95:      {metricas.box.map:.4f}")

    args.salida_pesos.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ruta_mejor, args.salida_pesos)
    print(f"\nMejores pesos guardados en: {args.salida_pesos.resolve()}")

    if args.export_onnx:
        detector_final = YOLO(str(args.salida_pesos.resolve()))
        ruta_onnx = detector_final.export(format="onnx", imgsz=args.imgsz)
        print(f"Modelo ONNX exportado: {ruta_onnx}")


if __name__ == "__main__":
    entrenar()
