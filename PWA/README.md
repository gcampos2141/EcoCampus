# EcoCampus PWA

## Desarrollo

1. Copia `.env.example` a `.env` y confirma que `VITE_API_BASE_URL` apunte a la API.
2. Desde esta carpeta, ejecuta `npm install` y `npm run dev`.
3. Inicia el backend según [la guía de la API](../IA/api/README.md).
4. En despliegue, sirve la PWA por HTTPS y define `VITE_API_BASE_URL` antes del build.

La aplicación necesita conexión con la API para iniciar sesión, consultar saldos,
escanear estaciones, validar evidencia y canjear recompensas. El service worker conserva
la interfaz estática para abrirla sin conexión, pero no cachea datos personales ni
permite registrar depósitos offline.
