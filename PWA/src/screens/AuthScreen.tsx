import { useState, type FormEvent } from 'react'
import { api, type User } from '../lib/api'

interface Props {
  onAuthenticated: (token: string, user: User) => void
  initialError?: string
}

export default function AuthScreen({ onAuthenticated, initialError = '' }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = creating
        ? await api.register(name.trim(), email.trim(), password)
        : await api.login(email.trim(), password)
      onAuthenticated(response.access_token, response.usuario)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-8" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl shadow-emerald-900/10">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-8 py-10 text-center text-white">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl text-emerald-600 shadow-lg">♻</div>
          <h1 className="text-3xl font-black tracking-tight">EcoCampus</h1>
          <p className="mt-2 text-sm text-emerald-50">Recicla en tu campus. Gana recompensas.</p>
        </div>

        <form onSubmit={submit} className="space-y-4 p-6 sm:p-8">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{creating ? 'Crear cuenta' : 'Bienvenido de nuevo'}</h2>
            <p className="mt-1 text-sm text-slate-500">Acceso para la comunidad UAQ</p>
          </div>

          {creating && (
            <label className="block text-sm font-semibold text-slate-700">
              Nombre completo
              <input
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={event => setName(event.target.value)}
                autoComplete="name"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none focus:border-emerald-500 focus:bg-white"
              />
            </label>
          )}

          <label className="block text-sm font-semibold text-slate-700">
            Correo institucional
            <input
              required
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="tu.nombre@alumnos.uaq.mx"
              autoComplete="email"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none focus:border-emerald-500 focus:bg-white"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Contraseña
            <input
              required
              minLength={8}
              maxLength={128}
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete={creating ? 'new-password' : 'current-password'}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-normal outline-none focus:border-emerald-500 focus:bg-white"
            />
          </label>

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 py-3.5 font-bold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? 'Conectando…' : creating ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
          <button
            type="button"
            onClick={() => { setCreating(value => !value); setError('') }}
            className="w-full rounded-xl border border-slate-200 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            {creating ? 'Ya tengo una cuenta' : 'Crear una cuenta'}
          </button>
          <p className="text-center text-xs leading-relaxed text-slate-400">
            La cuenta requiere correo <strong>@alumnos.uaq.mx</strong>. Para registrarse, la base de datos debe tener aplicada la migración indicada en el backend.
          </p>
        </form>
      </section>
    </main>
  )
}
