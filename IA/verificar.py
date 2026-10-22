import os

# Cambia '.' por la ruta de tu carpeta si el script no está en el mismo lugar
# Ejemplo: ruta_carpeta = "C:/datasets/train/images"
ruta_carpeta = 'drinking-waste-classification/Images_of_Waste/YOLO_imgs' 

# Extensiones de imagen soportadas comúnmente en YOLO
extensiones_imagen = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# Obtener todos los archivos en la carpeta
archivos = os.listdir(ruta_carpeta)

# Crear un set con los nombres (sin extensión) de los archivos .txt existentes
txt_existentes = {os.path.splitext(f)[0] for f in archivos if f.lower().endswith('.txt')}

# Buscar imágenes que no tengan su correspondiente .txt
imagenes_sin_txt = []
for f in archivos:
    nombre, ext = os.path.splitext(f)
    if ext.lower() in extensiones_imagen and nombre not in txt_existentes:
        imagenes_sin_txt.append(f)

# Mostrar resultados
if imagenes_sin_txt:
    print(f"❌ Se encontraron {len(imagenes_sin_txt)} imágenes SIN archivo .txt:\n")
    for img in imagenes_sin_txt:
        print(img)
else:
    print("✅ ¡Perfecto! Todas las imágenes tienen su respectivo archivo .txt.")