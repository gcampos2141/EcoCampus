import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import AuthScreen from './screens/AuthScreen'
import { SlPresent } from "react-icons/sl";
import { FaUserAlt } from "react-icons/fa";
import { MdDashboard, MdQrCodeScanner } from 'react-icons/md';
import { api, clearToken, getToken, saveToken, type Coupon, type Deposit, type Reward, type Station, type User } from './lib/api'

type Screen = 'dashboard' | 'scanner' | 'camera' | 'rewards' | 'voucher' | 'profile'

const DashboardScreen = lazy(() => import('./screens/DashboardScreen'))
const ScannerScreen = lazy(() => import('./screens/ScannerScreen'))
const CameraScreen = lazy(() => import('./screens/CameraScreen'))
const RewardsScreen = lazy(() => import('./screens/RewardsScreen'))
const VoucherScreen = lazy(() => import('./screens/VoucherScreen'))
const ProfileScreen = lazy(() => import('./screens/ProfileScreen'))

export default function App() {
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [user, setUser] = useState<User | null>(null)
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [station, setStation] = useState<Station | null>(null)
  const [activeCoupon, setActiveCoupon] = useState<Coupon | null>(null)
  const [voucherBackScreen, setVoucherBackScreen] = useState<Screen>('rewards')
  const [pageError, setPageError] = useState('')
  const [loading, setLoading] = useState(Boolean(getToken()))

  const refreshData = useCallback(async () => {
    const [account, history, catalog, vouchers] = await Promise.all([
      api.me(),
      api.deposits(),
      api.rewards(),
      api.coupons(),
    ])
    setUser(account)
    setDeposits(history)
    setRewards(catalog)
    setCoupons(vouchers)
  }, [])

  useEffect(() => {
    if (!getToken()) return
    refreshData()
      .catch(error => {
        clearToken()
        setPageError(error instanceof Error ? error.message : 'No se pudo recuperar la sesión.')
      })
      .finally(() => setLoading(false))
  }, [refreshData])

  const handleAuthenticated = (token: string, account: User) => {
    saveToken(token)
    setUser(account)
    setPageError('')
    setLoading(true)
    refreshData()
      .then(() => setScreen('dashboard'))
      .catch(error => setPageError(error instanceof Error ? error.message : 'No se pudieron cargar tus datos.'))
      .finally(() => setLoading(false))
  }

  const handleSignOut = () => {
    clearToken()
    setUser(null)
    setDeposits([])
    setCoupons([])
    setScreen('dashboard')
  }

  const handleRedeem = async (rewardId: number) => {
    const redeemed = await api.redeem(rewardId)
    setActiveCoupon(redeemed.cupon)
    setVoucherBackScreen('rewards')
    setScreen('voucher')
    void refreshData().catch(error => setPageError(error instanceof Error ? error.message : 'No se pudo actualizar el catálogo.'))
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-emerald-50 text-emerald-800">Cargando EcoCampus…</div>
  }
  if (!user) {
    return <AuthScreen onAuthenticated={handleAuthenticated} initialError={pageError} />
  }

  const pageTitle: Record<Screen, string> = {
    dashboard: 'Inicio',
    scanner: 'Escanear estación',
    camera: 'Validar reciclaje',
    rewards: 'Recompensas',
    voucher: 'Mi cupón',
    profile: 'Mi perfil',
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col bg-white shadow-xl">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-lg text-white">♻</div>
            <div>
              <p className="text-sm font-extrabold leading-tight">EcoCampus</p>
              <p className="text-[11px] text-slate-500">{pageTitle[screen]}</p>
            </div>
          </div>
          <button onClick={() => setScreen('profile')} className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
            {user.saldo_puntos.toLocaleString()} pts
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto pb-24">
          {pageError && (
            <div role="alert" className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {pageError}
              <button onClick={() => setPageError('')} className="ml-3 font-bold">Cerrar</button>
            </div>
          )}
          <Suspense fallback={<div className="p-6 text-center text-sm text-slate-500">Cargando pantalla…</div>}>
            {screen === 'dashboard' && (
              <DashboardScreen
                user={user}
                deposits={deposits.slice(0, 5)}
                onScan={() => { setPageError(''); setScreen('scanner') }}
                onRewards={() => { setPageError(''); setScreen('rewards') }}
                onProfile={() => { setPageError(''); setScreen('profile') }}
              />
            )}
            {screen === 'scanner' && (
              <ScannerScreen
                onSuccess={selectedStation => { setStation(selectedStation); setScreen('camera') }}
                onBack={() => setScreen('dashboard')}
              />
            )}
            {screen === 'camera' && station && (
              <CameraScreen
                station={station}
                onBack={() => setScreen('scanner')}
                onComplete={result => {
                  if (result.deposito) {
                    setUser(current => current ? { ...current, saldo_puntos: result.saldo_puntos ?? current.saldo_puntos } : current)
                    void refreshData().catch(error => setPageError(error instanceof Error ? error.message : 'No se pudo actualizar el historial.'))
                  }
                }}
              />
            )}
            {screen === 'camera' && !station && (
              <div className="p-6 text-center">
                <p className="mb-4">Primero escanea el QR de una estación de reciclaje.</p>
                <button onClick={() => setScreen('scanner')} className="rounded-xl bg-emerald-500 px-5 py-3 font-bold text-white">Escanear estación</button>
              </div>
            )}
            {screen === 'rewards' && (
              <RewardsScreen
                rewards={rewards}
                points={user.saldo_puntos}
                onRedeem={handleRedeem}
                onBack={() => setScreen('dashboard')}
              />
            )}
            {screen === 'voucher' && (
              <VoucherScreen coupon={activeCoupon ?? coupons[0] ?? null} onBack={() => setScreen(voucherBackScreen)} />
            )}
            {screen === 'profile' && (
              <ProfileScreen
                user={user}
                deposits={deposits}
                coupons={coupons}
                onCouponSelect={coupon => {
                  setActiveCoupon(coupon)
                  setVoucherBackScreen('profile')
                  setScreen('voucher')
                }}
                onBack={() => setScreen('dashboard')}
                onSignOut={handleSignOut}
              />
            )}
          </Suspense>
        </main>

        <nav aria-label="Navegación principal" className="fixed bottom-0 z-20 mx-auto grid w-full max-w-2xl grid-cols-4 border-t border-slate-200 bg-white px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
          {([
            ['dashboard', 'Inicio', <MdDashboard className="h-6 w-6" />],
            ['scanner', 'Reciclar', <MdQrCodeScanner className="h-6 w-6" />],
            ['rewards', 'Premios', <SlPresent className="h-6 w-6" />],
            ['profile', 'Perfil', <FaUserAlt className="h-6 w-6" />],
          ] as const).map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => { setPageError(''); setScreen(id) }}
              className={`flex flex-col items-center gap-0.5 py-1 text-xs font-semibold ${screen === id ? 'text-emerald-600' : 'text-slate-400'}`}
            >
              <span className="text-xl leading-5">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
