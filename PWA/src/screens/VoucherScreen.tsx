import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { Coupon } from '../lib/api'

interface Props {
  coupon: Coupon | null
  onBack: () => void
}

export default function VoucherScreen({ coupon, onBack }: Props) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setTick(value => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  if (!coupon) {
    return (
      <section className="mx-auto max-w-lg p-6">
        <button onClick={onBack} className="mb-5 text-sm font-semibold text-slate-500">← Recompensas</button>
        <p className="rounded-2xl bg-slate-50 p-6 text-center text-slate-600">Aún no tienes cupones. Elige una recompensa del catálogo para generar uno.</p>
      </section>
    )
  }

  const expiresAt = new Date(coupon.fecha_expiracion).getTime()
  const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
  const active = coupon.estado_cupon === 'DISPONIBLE' && remaining > 0
  const timeLeft = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`
  const statusLabel = coupon.estado_cupon === 'USADO'
    ? 'Cupón utilizado'
    : coupon.estado_cupon === 'EXPIRADO' || (coupon.estado_cupon === 'DISPONIBLE' && remaining <= 0)
      ? 'Cupón vencido'
      : active
        ? `Vence en ${timeLeft}`
        : 'Cupón no disponible'

  return (
    <section className="mx-auto max-w-lg px-5 py-6">
      <button onClick={onBack} className="mb-5 text-sm font-semibold text-slate-500">← Recompensas</button>
      <h1 className="text-2xl font-black">Tu cupón</h1>
      <p className="mt-1 text-sm text-slate-500">Muestra el QR en el punto participante para validar el canje.</p>

      <div className="mt-5 overflow-hidden rounded-3xl border border-slate-100 shadow-lg">
        <div className={`p-5 text-white ${active ? 'bg-gradient-to-br from-emerald-500 to-teal-700' : 'bg-slate-500'}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-white/75">EcoCampus · Recompensa</p>
          <h2 className="mt-2 text-xl font-black">{coupon.titulo}</h2>
          <p className="mt-2 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-bold">{statusLabel}</p>
        </div>
        <div className="flex flex-col items-center bg-white p-6">
          <div className={`rounded-2xl border border-slate-100 p-3 ${active ? '' : 'opacity-40 grayscale'}`}>
            <QRCodeSVG value={coupon.codigo_unico} size={192} level="M" includeMargin />
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Código de canje</p>
          <p className="mt-1 break-all text-center font-mono text-lg font-black tracking-wide text-slate-800">{coupon.codigo_unico}</p>
          <p className="mt-3 text-center text-xs text-slate-500">
            Canjeado {new Date(coupon.fecha_canje).toLocaleString('es-MX')} · {coupon.puntos_canjeados ?? coupon.puntos_requeridos ?? 0} puntos
          </p>
        </div>
      </div>
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        El QR contiene el código único guardado en tu cuenta. La validación del uso del cupón por parte del comercio requiere una interfaz/endpoint de personal, todavía no incluido en el esquema actual.
      </p>
    </section>
  )
}
