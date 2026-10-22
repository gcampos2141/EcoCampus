import { useState } from 'react'
import type { Reward } from '../lib/api'

interface Props {
  rewards: Reward[]
  points: number
  onRedeem: (rewardId: number) => Promise<void>
  onBack: () => void
}

export default function RewardsScreen({ rewards, points, onRedeem, onBack }: Props) {
  const [selected, setSelected] = useState<Reward | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const confirm = async () => {
    if (!selected) return
    setLoading(true)
    setError('')
    try {
      await onRedeem(selected.id_recompensa)
      setSelected(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo generar el cupón.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mx-auto max-w-lg px-5 py-6">
      <button onClick={onBack} className="mb-4 text-sm font-semibold text-slate-500">← Inicio</button>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Recompensas</h1>
          <p className="mt-1 text-sm text-slate-500">Canjea tus puntos por beneficios disponibles.</p>
        </div>
        <p className="shrink-0 rounded-full bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-800">{points.toLocaleString()} pts</p>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rewards.map(reward => {
          const affordable = points >= reward.puntos_requeridos
          return (
            <article key={reward.id_recompensa} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-2xl">🎁</div>
              <h2 className="mt-3 font-extrabold">{reward.titulo}</h2>
              <p className="mt-1 min-h-10 text-sm text-slate-500">{reward.descripcion || 'Recompensa de EcoCampus'}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-black text-emerald-700">{reward.puntos_requeridos.toLocaleString()} pts</span>
                <span className="text-xs text-slate-400">{reward.stock_disponible} disponibles</span>
              </div>
              <button
                disabled={!affordable}
                onClick={() => setSelected(reward)}
                className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                {affordable ? 'Canjear' : `Faltan ${(reward.puntos_requeridos - points).toLocaleString()} pts`}
              </button>
            </article>
          )
        })}
        {rewards.length === 0 && (
          <p className="col-span-full rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">No hay recompensas disponibles en este momento.</p>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center">
          <div role="dialog" aria-modal="true" aria-labelledby="redeem-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-200" />
            <h2 id="redeem-title" className="text-xl font-black">Confirmar canje</h2>
            <p className="mt-2 text-slate-600">{selected.titulo}</p>
            <div className="mt-4 flex justify-between rounded-xl bg-slate-50 p-4 text-sm">
              <span>Saldo después del canje</span>
              <strong>{(points - selected.puntos_requeridos).toLocaleString()} pts</strong>
            </div>
            <p className="mt-3 text-xs text-slate-500">El servidor descontará los puntos y reservará una unidad. El cupón generado vence en 10 minutos.</p>
            <button onClick={() => void confirm()} disabled={loading} className="mt-5 w-full rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">
              {loading ? 'Generando cupón…' : 'Confirmar canje'}
            </button>
            <button onClick={() => setSelected(null)} disabled={loading} className="mt-2 w-full py-3 text-sm font-semibold text-slate-500">Cancelar</button>
          </div>
        </div>
      )}
    </section>
  )
}
