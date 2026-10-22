export interface User {
  id_usuario: number
  nombre: string
  correo: string
  saldo_puntos: number
  nivel: number
}

export interface Station {
  id_estacion: number
  nombre_estacion: string
  codigo_qr: string
  latitud: number
  longitud: number
}

export interface Deposit {
  id_deposito: number
  tipo_material: 'PET' | 'ALUMINIO'
  puntos_otorgados: number
  fecha_deposito: string
  nombre_estacion: string
}

export interface Evidence {
  estado: 'ACEPTADO' | 'RECHAZADO' | 'REINTENTAR'
  material: string
  confianza: number
  mensaje: string
  detecciones: Array<{
    clase: string
    confianza: number
    caja_normalizada: [number, number, number, number]
  }>
}

export interface DepositResponse {
  evidencia: Evidence
  deposito: Deposit | null
  puntos_otorgados: number
  saldo_puntos?: number
}

export interface Reward {
  id_recompensa: number
  titulo: string
  descripcion: string
  puntos_requeridos: number
  stock_disponible: number
}

export interface Coupon {
  id_cupon: number
  codigo_unico: string
  estado_cupon: string
  fecha_canje: string
  fecha_expiracion: string
  titulo: string
  puntos_canjeados?: number
  puntos_requeridos?: number
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const TOKEN_KEY = 'ecocampus_access_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new Error('No se pudo conectar con EcoCampus. Verifica que la API esté encendida.')
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = typeof body === 'object' && body !== null && 'detail' in body ? body.detail : null
    const message = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map(item => typeof item === 'object' && item !== null && 'msg' in item ? String(item.msg) : '').filter(Boolean).join(' ')
        : ''
    throw new Error(message || `Error del servidor (${response.status}).`)
  }
  return body as T
}

export const api = {
  login: (correo: string, password: string) =>
    request<{ access_token: string; usuario: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ correo, password }),
    }),
  register: (nombre: string, correo: string, password: string) =>
    request<{ access_token: string; usuario: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nombre, correo, password }),
    }),
  me: () => request<User>('/me'),
  station: (code: string) => request<Station>(`/stations/qr/${encodeURIComponent(code)}`),
  deposits: () => request<Deposit[]>('/deposits'),
  rewards: () => request<Reward[]>('/rewards'),
  coupons: () => request<Coupon[]>('/coupons'),
  redeem: (id: number) =>
    request<{ cupon: Coupon; saldo_puntos: number }>(`/rewards/${id}/redeem`, { method: 'POST' }),
  submitEvidence: (image: Blob, filename: string, station: Station, latitude: number, longitude: number) => {
    const form = new FormData()
    form.append('image', image, filename)
    form.append('codigo_qr', station.codigo_qr)
    form.append('latitud', String(latitude))
    form.append('longitud', String(longitude))
    return request<DepositResponse>('/deposits', { method: 'POST', body: form })
  },
}
