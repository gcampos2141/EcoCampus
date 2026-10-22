from __future__ import annotations

import os
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any

import jwt
import psycopg
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from psycopg.rows import dict_row
from pwdlib import PasswordHash

IA_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(IA_ROOT / ".env")
if str(IA_ROOT) not in sys.path:
    sys.path.insert(0, str(IA_ROOT))

from clasificador import (
    ImagenInvalida,
    RUTA_MODELO,
    buscar_duplicado,
    obtener_clasificador,
    procesar_evidencia,
)

APP_NAME = "EcoCampus API"
DATABASE_URL = os.getenv("DATABASE_URL", "")
JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
TOKEN_HOURS = 12
DOMAIN = "@alumnos.uaq.mx"
MAX_UPLOAD_BYTES = 8 * 1024 * 1024
STATION_RADIUS_METERS = float(os.getenv("STATION_RADIUS_METERS", "50"))
POINTS_BY_MATERIAL = {"PET": 50, "ALUMINIO": 35}
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8443,http://127.0.0.1:8443",
    ).split(",")
    if origin.strip()
]

password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)

app = FastAPI(title=APP_NAME, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class Credentials(BaseModel):
    correo: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RegisterRequest(Credentials):
    nombre: str = Field(min_length=2, max_length=100)


def get_connection() -> psycopg.Connection:
    if not DATABASE_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La API no tiene DATABASE_URL configurada.",
        )
    try:
        return psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=8)
    except psycopg.Error as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No fue posible conectar con PostgreSQL.",
        ) from error


def create_access_token(user_id: int) -> str:
    if len(JWT_SECRET) < 32:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configura JWT_SECRET con al menos 32 caracteres aleatorios.",
        )
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(hours=TOKEN_HOURS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def require_jwt_secret() -> None:
    if len(JWT_SECRET) < 32:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Configura JWT_SECRET con al menos 32 caracteres aleatorios.",
        )


def authenticate_user(credentials: Credentials) -> dict[str, Any]:
    with get_connection() as connection:
        user = connection.execute(
            """
            SELECT id_usuario, nombre, correo, password_hash, saldo_puntos, nivel
            FROM usuarios
            WHERE lower(correo) = lower(%s)
            """,
            (str(credentials.correo),),
        ).fetchone()
    if user is None or not password_hash.verify(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")
    return user


def current_user(
    auth: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict[str, Any]:
    if auth is None or len(JWT_SECRET) < 32:
        raise HTTPException(status_code=401, detail="Inicia sesión para continuar.")
    try:
        payload = jwt.decode(auth.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError) as error:
        raise HTTPException(status_code=401, detail="La sesión expiró o no es válida.") from error

    with get_connection() as connection:
        user = connection.execute(
            """
            SELECT id_usuario, nombre, correo, saldo_puntos, nivel
            FROM usuarios
            WHERE id_usuario = %s
            """,
            (user_id,),
        ).fetchone()
    if user is None:
        raise HTTPException(status_code=401, detail="La cuenta asociada a la sesión ya no existe.")
    return user


def user_payload(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id_usuario": user["id_usuario"],
        "nombre": user["nombre"],
        "correo": user["correo"],
        "saldo_puntos": user["saldo_puntos"],
        "nivel": user["nivel"],
    }


def auth_response(user: dict[str, Any]) -> dict[str, Any]:
    return {"access_token": create_access_token(user["id_usuario"]), "token_type": "bearer", "usuario": user_payload(user)}


@app.get("/api/health")
def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "database_configured": bool(DATABASE_URL),
        "jwt_configured": len(JWT_SECRET) >= 32,
        "model_available": Path(RUTA_MODELO).is_file(),
        "model_path": str(RUTA_MODELO),
    }


@app.post("/api/auth/register", status_code=201)
def register_user(payload: RegisterRequest) -> dict[str, Any]:
    require_jwt_secret()
    correo = str(payload.correo).strip().lower()
    if not correo.endswith(DOMAIN):
        raise HTTPException(status_code=422, detail=f"Usa tu correo institucional {DOMAIN}.")
    encoded_password = password_hash.hash(payload.password)
    try:
        with get_connection() as connection:
            user = connection.execute(
                """
                INSERT INTO usuarios (nombre, correo, password_hash)
                VALUES (%s, %s, %s)
                RETURNING id_usuario, nombre, correo, saldo_puntos, nivel
                """,
                (payload.nombre.strip(), correo, encoded_password),
            ).fetchone()
    except psycopg.errors.UniqueViolation as error:
        raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese correo.") from error
    except psycopg.errors.CheckViolation as error:
        raise HTTPException(
            status_code=409,
            detail="La restricción de correo de PostgreSQL todavía no permite @alumnos.uaq.mx; aplica la migración documentada.",
        ) from error
    return auth_response(user)


@app.post("/api/auth/login")
def login(payload: Credentials) -> dict[str, Any]:
    return auth_response(authenticate_user(payload))


@app.get("/api/me")
def get_me(user: Annotated[dict[str, Any], Depends(current_user)]) -> dict[str, Any]:
    return user_payload(user)


@app.get("/api/stations/qr/{codigo_qr}")
def get_station(codigo_qr: str) -> dict[str, Any]:
    with get_connection() as connection:
        station = connection.execute(
            """
            SELECT id_estacion, nombre_estacion, codigo_qr, latitud, longitud
            FROM estaciones_reciclaje
            WHERE codigo_qr = %s AND estado = 'ACTIVA'
            """,
            (codigo_qr,),
        ).fetchone()
    if station is None:
        raise HTTPException(status_code=404, detail="El QR no corresponde a una estación activa.")
    station["latitud"] = float(station["latitud"])
    station["longitud"] = float(station["longitud"])
    return station


@app.get("/api/rewards")
def list_rewards() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rewards = connection.execute(
            """
            SELECT id_recompensa, titulo, descripcion, puntos_requeridos, stock_disponible
            FROM catalogo_recompensas
            WHERE estado = 'DISPONIBLE' AND stock_disponible > 0
            ORDER BY puntos_requeridos, id_recompensa
            """
        ).fetchall()
    return list(rewards)


def distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import asin, cos, radians, sin, sqrt

    earth_radius = 6_371_000
    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)
    value = sin(delta_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(delta_lon / 2) ** 2
    return 2 * earth_radius * asin(sqrt(value))


@app.post("/api/deposits")
def create_deposit(
    user: Annotated[dict[str, Any], Depends(current_user)],
    codigo_qr: Annotated[str, Form()],
    latitud: Annotated[float, Form(ge=-90, le=90)],
    longitud: Annotated[float, Form(ge=-180, le=180)],
    image: Annotated[UploadFile, File()],
) -> dict[str, Any]:
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Sube una fotografía JPG, PNG o WebP.")
    image_bytes = image.file.read(MAX_UPLOAD_BYTES + 1)
    if not image_bytes or len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="La foto supera el límite de 8 MB o está vacía.")

    with get_connection() as connection:
        station = connection.execute(
            """
            SELECT id_estacion, nombre_estacion, latitud, longitud
            FROM estaciones_reciclaje
            WHERE codigo_qr = %s AND estado = 'ACTIVA'
            """,
            (codigo_qr,),
        ).fetchone()
        if station is None:
            raise HTTPException(status_code=404, detail="El QR no corresponde a una estación activa.")

        separation = distance_meters(
            float(station["latitud"]),
            float(station["longitud"]),
            latitud,
            longitud,
        )
        if separation > STATION_RADIUS_METERS:
            raise HTTPException(
                status_code=403,
                detail=f"Debes estar a menos de {int(STATION_RADIUS_METERS)} m de la estación., te encuentras en : {latitud}, {longitud} y la estación está en: {station['latitud']}, {station['longitud']} a una distancia de {int(separation)} m.",
            )

        try:
            evidence = procesar_evidencia(image_bytes)
        except ImagenInvalida as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

        if evidence["estado"] != "ACEPTADO":
            return {"evidencia": evidence, "deposito": None, "puntos_otorgados": 0}

        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(74123901)")
            recent_hashes = cursor.execute(
                """
                SELECT phash_evidencia
                FROM registros_deposito
                WHERE fecha_deposito > now() - interval '7 days'
                """
            ).fetchall()
            duplicate, distance = buscar_duplicado(
                evidence["phash"],
                (row["phash_evidencia"] for row in recent_hashes),
            )
            if duplicate:
                evidence["estado"] = "RECHAZADO"
                evidence["mensaje"] = "Esta fotografía ya fue registrada."
                evidence["distancia_hamming"] = distance
                return {"evidencia": evidence, "deposito": None, "puntos_otorgados": 0}

            material = evidence["material"]
            points = POINTS_BY_MATERIAL[material]
            deposit = cursor.execute(
                """
                INSERT INTO registros_deposito (
                    id_usuario, id_estacion, tipo_material, puntos_otorgados,
                    phash_evidencia, latitud_registro, longitud_registro
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id_deposito, id_estacion, tipo_material, puntos_otorgados, fecha_deposito
                """,
                (
                    user["id_usuario"],
                    station["id_estacion"],
                    material,
                    points,
                    evidence["phash"],
                    latitud,
                    longitud,
                ),
            ).fetchone()
            updated_user = cursor.execute(
                """
                UPDATE usuarios
                SET saldo_puntos = saldo_puntos + %s
                WHERE id_usuario = %s
                RETURNING saldo_puntos
                """,
                (points, user["id_usuario"]),
            ).fetchone()
        deposit["fecha_deposito"] = deposit["fecha_deposito"].isoformat()
    return {
        "evidencia": evidence,
        "deposito": {**deposit, "nombre_estacion": station["nombre_estacion"]},
        "puntos_otorgados": points,
        "saldo_puntos": updated_user["saldo_puntos"],
    }


@app.get("/api/deposits")
def list_deposits(user: Annotated[dict[str, Any], Depends(current_user)]) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT d.id_deposito, d.tipo_material, d.puntos_otorgados, d.fecha_deposito,
                   e.nombre_estacion
            FROM registros_deposito AS d
            JOIN estaciones_reciclaje AS e ON e.id_estacion = d.id_estacion
            WHERE d.id_usuario = %s
            ORDER BY d.fecha_deposito DESC
            LIMIT 100
            """,
            (user["id_usuario"],),
        ).fetchall()
    return [
        {**row, "fecha_deposito": row["fecha_deposito"].isoformat() if row["fecha_deposito"] else None}
        for row in rows
    ]


@app.post("/api/rewards/{reward_id}/redeem", status_code=201)
def redeem_reward(
    reward_id: int,
    user: Annotated[dict[str, Any], Depends(current_user)],
) -> dict[str, Any]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            reward = cursor.execute(
                """
                SELECT id_recompensa, titulo, puntos_requeridos, stock_disponible
                FROM catalogo_recompensas
                WHERE id_recompensa = %s AND estado = 'DISPONIBLE'
                FOR UPDATE
                """,
                (reward_id,),
            ).fetchone()
            if reward is None or reward["stock_disponible"] < 1:
                raise HTTPException(status_code=404, detail="La recompensa no está disponible.")

            account = cursor.execute(
                "SELECT saldo_puntos FROM usuarios WHERE id_usuario = %s FOR UPDATE",
                (user["id_usuario"],),
            ).fetchone()
            if account["saldo_puntos"] < reward["puntos_requeridos"]:
                raise HTTPException(status_code=409, detail="No tienes puntos suficientes.")

            now = datetime.now(timezone.utc)
            code = f"ECO-{secrets.token_urlsafe(12).upper()}"
            coupon = cursor.execute(
                """
                INSERT INTO cupones_canjeados (
                    id_usuario, id_recompensa, codigo_unico, estado_cupon, fecha_expiracion
                )
                VALUES (%s, %s, %s, 'DISPONIBLE', %s)
                RETURNING id_cupon, codigo_unico, estado_cupon, fecha_canje, fecha_expiracion
                """,
                (
                    user["id_usuario"],
                    reward_id,
                    code,
                    now + timedelta(minutes=10),
                ),
            ).fetchone()
            balance = cursor.execute(
                """
                UPDATE usuarios
                SET saldo_puntos = saldo_puntos - %s
                WHERE id_usuario = %s
                RETURNING saldo_puntos
                """,
                (reward["puntos_requeridos"], user["id_usuario"]),
            ).fetchone()["saldo_puntos"]
            cursor.execute(
                """
                UPDATE catalogo_recompensas
                SET stock_disponible = stock_disponible - 1,
                    estado = CASE WHEN stock_disponible = 1 THEN 'AGOTADO' ELSE estado END
                WHERE id_recompensa = %s
                """,
                (reward_id,),
            )
    return {
        "cupon": {
            **coupon,
            "titulo": reward["titulo"],
            "puntos_canjeados": reward["puntos_requeridos"],
            "fecha_canje": coupon["fecha_canje"].isoformat(),
            "fecha_expiracion": coupon["fecha_expiracion"].isoformat(),
        },
        "saldo_puntos": balance,
    }


@app.get("/api/coupons")
def list_coupons(user: Annotated[dict[str, Any], Depends(current_user)]) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT c.id_cupon, c.codigo_unico, c.estado_cupon, c.fecha_canje,
                   c.fecha_expiracion, r.titulo, r.puntos_requeridos
            FROM cupones_canjeados AS c
            JOIN catalogo_recompensas AS r ON r.id_recompensa = c.id_recompensa
            WHERE c.id_usuario = %s
            ORDER BY c.fecha_canje DESC
            LIMIT 100
            """,
            (user["id_usuario"],),
        ).fetchall()
    return [
        {
            **row,
            "fecha_canje": row["fecha_canje"].isoformat() if row["fecha_canje"] else None,
            "fecha_expiracion": row["fecha_expiracion"].isoformat() if row["fecha_expiracion"] else None,
        }
        for row in rows
    ]


@app.on_event("startup")
def warm_detector() -> None:
    model_path = os.getenv("ECOCAMPUS_MODELO", "")
    if model_path:
        obtener_clasificador()
