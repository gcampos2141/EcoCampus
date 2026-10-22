import { useState } from 'react'
import type { Coupon, Deposit, User } from '../lib/api'

interface Props {
  user: User
  deposits: Deposit[]
  coupons: Coupon[]
  onCouponSelect: (coupon: Coupon) => void
  onBack: () => void
  onSignOut: () => void
}

export default function ProfileScreen({ user, deposits, coupons, onCouponSelect, onBack, onSignOut }: Props) {
  const [tab, setTab] = useState<'deposits' | 'coupons'>('deposits')
  const initials = user.nombre.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()

  return (
    <section className="mx-auto max-w-lg px-5 py-6">
      <button onClick={onBack} className="mb-5 text-sm font-semibold text-slate-500">← Inicio</button>
      <div className="flex items-center gap-4 rounded-2xl bg-emerald-50 p-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-black text-white">{initials}</div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black">{user.nombre}</h1>
          <p className="truncate text-sm text-slate-600">{user.correo}</p>
          <p className="mt-1 text-xs font-bold text-emerald-800">Nivel {user.nivel}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-100 p-3 text-center">
          <p className="text-xl font-black text-emerald-700">{user.saldo_puntos.toLocaleString()}</p>
          <p className="text-xs text-slate-500">Puntos</p>
        </div>
        <div className="rounded-xl border border-slate-100 p-3 text-center">
          <p className="text-xl font-black text-slate-800">{deposits.length}</p>
          <p className="text-xs text-slate-500">Depósitos</p>
        </div>
        <div className="rounded-xl border border-slate-100 p-3 text-center">
          <p className="text-xl font-black text-slate-800">{coupons.length}</p>
          <p className="text-xs text-slate-500">Cupones</p>
        </div>
      </div>

      <div className="mt-6 flex rounded-xl bg-slate-100 p-1">
        <button onClick={() => setTab('deposits')} className={`flex-1 rounded-lg py-2 text-sm font-bold ${tab === 'deposits' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>Depósitos</button>
        <button onClick={() => setTab('coupons')} className={`flex-1 rounded-lg py-2 text-sm font-bold ${tab === 'coupons' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>Cupones</button>
      </div>

      <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white px-4">
        {tab === 'deposits' && (deposits.length ? deposits.map(deposit => (
          <div key={deposit.id_deposito} className="flex items-center gap-3 py-3">
            <span className="text-xl">{deposit.tipo_material === 'PET' ? '🧴' : '🥫'}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{deposit.tipo_material === 'PET' ? 'PET' : 'Aluminio'}</p>
              <p className="truncate text-xs text-slate-500">{deposit.nombre_estacion} · {new Date(deposit.fecha_deposito).toLocaleString('es-MX')}</p>
            </div>
            <span className="text-sm font-bold text-emerald-700">+{deposit.puntos_otorgados}</span>
          </div>
        )) : <p className="py-6 text-center text-sm text-slate-500">Todavía no hay depósitos registrados.</p>)}
        {tab === 'coupons' && (coupons.length ? coupons.map(coupon => (
          <button
            key={coupon.id_cupon}
            type="button"
            onClick={() => onCouponSelect(coupon)}
            aria-label={`Ver cupón ${coupon.titulo}, ${coupon.puntos_canjeados ?? coupon.puntos_requeridos ?? 0} puntos utilizados`}
            className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            <span className="text-xl">🎟️</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{coupon.titulo}</p>
              <p className="truncate text-xs text-slate-500">{coupon.codigo_unico} · {coupon.estado_cupon} · {new Date(coupon.fecha_canje).toLocaleDateString('es-MX')}</p>
            </div>
            <span className="shrink-0 text-sm font-bold text-rose-600">−{(coupon.puntos_canjeados ?? coupon.puntos_requeridos ?? 0).toLocaleString()}</span>
            <span aria-hidden="true" className="text-slate-400">›</span>
          </button>
        )) : <p className="py-6 text-center text-sm text-slate-500">Todavía no has canjeado recompensas.</p>)}
      </div>

      <button onClick={onSignOut} className="mt-6 w-full rounded-xl border border-red-200 py-3 font-bold text-red-600 hover:bg-red-50">Cerrar sesión</button>
    </section>
  )
}
