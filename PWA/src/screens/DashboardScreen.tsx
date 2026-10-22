import type { Deposit, User } from '../lib/api'

interface Props {
  user: User
  deposits: Deposit[]
  onScan: () => void
  onRewards: () => void
  onProfile: () => void
}

export default function DashboardScreen({ user, deposits, onScan, onRewards, onProfile }: Props) {
  const initials = user.nombre.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()

  return (
    <section className="mx-auto max-w-lg px-5 py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Hola,</p>
          <h1 className="text-2xl font-black text-slate-900">{user.nombre.split(' ')[0]} 👋</h1>
          <p className="mt-1 text-xs font-medium text-emerald-700">Nivel {user.nivel} · Comunidad EcoCampus</p>
        </div>
        <button onClick={onProfile} aria-label="Abrir perfil" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 font-black text-emerald-800">
          {initials}
        </button>
      </div>

      <div className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 p-6 text-white shadow-xl shadow-emerald-900/15">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
        <p className="relative text-xs font-bold uppercase tracking-wider text-emerald-100">Tu saldo disponible</p>
        <p className="relative mt-2 text-5xl font-black tracking-tight">{user.saldo_puntos.toLocaleString()}</p>
        <p className="relative mt-1 text-sm font-semibold text-emerald-100">Eco-puntos</p>
        <div className="relative mt-6 flex gap-2">
          <button onClick={onScan} className="flex-1 rounded-xl bg-white px-3 py-3 text-sm font-extrabold text-emerald-800 shadow hover:bg-emerald-50">
            ♻ Registrar reciclaje
          </button>
          <button onClick={onRewards} className="rounded-xl border border-white/40 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20">
            Premios
          </button>
        </div>
      </div>

      <section className="mt-7">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Actividad reciente</h2>
          <button onClick={onProfile} className="text-xs font-bold text-emerald-700">Ver historial</button>
        </div>
        <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white px-4">
          {deposits.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Aún no tienes depósitos. Escanea una estación para comenzar.</p>
          ) : deposits.map(deposit => (
            <div key={deposit.id_deposito} className="flex items-center gap-3 py-3.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xl">{deposit.tipo_material === 'PET' ? '🧴' : '🥫'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{deposit.tipo_material === 'PET' ? 'Botella PET' : 'Lata de aluminio'}</p>
                <p className="truncate text-xs text-slate-500">{deposit.nombre_estacion} · {new Date(deposit.fecha_deposito).toLocaleDateString('es-MX')}</p>
              </div>
              <span className="text-sm font-black text-emerald-700">+{deposit.puntos_otorgados}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50 p-4">
        <p className="font-bold text-teal-900">Cada envase cuenta 🌱</p>
        <p className="mt-1 text-sm leading-relaxed text-teal-800">Lleva tu PET o lata a una estación participante, registra la evidencia y acumula puntos para canjear recompensas.</p>
      </div>
    </section>
  )
}
