# EcoCampus API

La PWA nunca se conecta directamente a PostgreSQL. Esta FastAPI lee `DATABASE_URL` y
`JWT_SECRET` del entorno y ejecuta el detector existente en `IA/clasificador.py`.

## Ejecución local (PowerShell)

Desde la carpeta `IA`:

```powershell
Copy-Item .env.example .env
# Edita .env con la URL de PostgreSQL y un secreto aleatorio de al menos 32 caracteres.
.\.venv\Scripts\python.exe -m pip install -r requirements-api.txt
.\.venv\Scripts\python.exe -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 1
```

El servicio carga `IA/.env` si existe. Comprueba `/api/health` y la especificación
interactiva en `/docs`. Mantén un solo worker en este MVP para no cargar varias copias
del modelo en memoria. En Render, usa `IA` como directorio raíz, instala
`requirements-api.txt` y arranca con `uvicorn api.main:app --host 0.0.0.0 --port $PORT --workers 1`.
Configura las mismas variables como secretos/variables del servicio, no en React.
`/api/health` indica si PostgreSQL, JWT y el archivo del modelo están configurados o disponibles.

## Rutas disponibles

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/me`
- `GET /api/stations/qr/{codigo_qr}`
- `POST /api/deposits` (multipart: `image`, `codigo_qr`, `latitud`, `longitud`)
- `GET /api/deposits`
- `GET /api/rewards`, `POST /api/rewards/{id}/redeem`, `GET /api/coupons`

El depósito requiere una estación activa y geolocalización a 50 m o menos (configurable
con `STATION_RADIUS_METERS`). El servidor ejecuta la inferencia, compara pHash de los
últimos siete días y solo acredita PET/aluminio aceptados. Los valores de 50 puntos para
PET y 35 para aluminio son una política inicial del MVP (`POINTS_BY_MATERIAL`).
La foto no se conserva: se registra el pHash. `url_evidencia` debe permitir NULL en la
tabla hasta conectar almacenamiento privado de imágenes.

## Ajuste de correo UAQ

El registro valida `@alumnos.uaq.mx`; la restricción actual de PostgreSQL que acepta
`%edu%` lo rechazará. Revisa y ejecuta manualmente
[`migrations/001_allow_uaq_student_emails.sql`](./migrations/001_allow_uaq_student_emails.sql)
en la base correcta antes de habilitar registros. No se realizan cambios remotos
automáticos.

## Límites actuales del MVP

- Debe haber estaciones activas con `codigo_qr` y coordenadas, y recompensas disponibles
  cargadas en PostgreSQL.
- La distancia GPS enviada por el navegador es una señal de conveniencia para el MVP,
  no una prueba resistente a suplantación.
- El QR del cupón es único y persistente, pero el esquema no proporciona rol de comercio
  ni una ruta segura para marcar cupones como usados; no debe tratarse aún como canje
  verificado.
- No hay columna de rol en `usuarios`; por ello no se conecta el panel administrativo
  simulado ni se concede acceso administrativo.
- Configura HTTPS para usar cámara y ubicación desde teléfonos. No expongas credenciales
  de PostgreSQL ni `JWT_SECRET` al frontend.
