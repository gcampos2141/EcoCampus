import { useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const hourlyData = [
  { hora: '6am', pet: 12, aluminio: 5 },
  { hora: '8am', pet: 45, aluminio: 18 },
  { hora: '10am', pet: 82, aluminio: 34 },
  { hora: '12pm', pet: 124, aluminio: 58 },
  { hora: '2pm', pet: 98, aluminio: 44 },
  { hora: '4pm', pet: 148, aluminio: 71 },
  { hora: '6pm', pet: 91, aluminio: 37 },
  { hora: '8pm', pet: 34, aluminio: 14 },
]

const facultadData = [
  { nombre: 'Informática', pet: 234, aluminio: 89 },
  { nombre: 'Medicina', pet: 187, aluminio: 67 },
  { nombre: 'Economía', pet: 198, aluminio: 78 },
  { nombre: 'Derecho', pet: 145, aluminio: 52 },
  { nombre: 'Arquitectura', pet: 112, aluminio: 45 },
  { nombre: 'Humanidades', pet: 89, aluminio: 34 },
]

const kpis = [
  { label: 'PET Recolectado', value: '1,247.8', unit: 'kg', change: '+12.4%', trend: 'up', color: 'emerald', icon: '🧴' },
  { label: 'Aluminio Recolectado', value: '312.4', unit: 'kg', change: '+8.7%', trend: 'up', color: 'blue', icon: '🥤' },
  { label: 'Usuarios Activos', value: '847', unit: 'este mes', change: '+23 nuevos', trend: 'up', color: 'violet', icon: '👥' },
  { label: 'Reducción Contaminación Cruzada', value: '94.2', unit: '%', change: '+2.1%', trend: 'up', color: 'amber', icon: '✅' },
]

const alerts = [
  { time: '09:38', station: 'Cafetería Central', event: 'Contenedor al 92% de capacidad', type: 'warning', user: '—' },
  { time: '09:22', station: 'Biblioteca Principal', event: 'Hash fotográfico duplicado detectado', type: 'error', user: 'mario.lopez@universidad.edu' },
  { time: '09:15', station: 'Auditorio', event: 'Depósito validado por IA · PET', type: 'success', user: 'daniela.reyes@universidad.edu' },
  { time: '08:57', station: 'Cafetería Norte', event: 'Material no identificado rechazado', type: 'error', user: 'carlos.vega@universidad.edu' },
  { time: '08:41', station: 'Cafetería Central', event: 'Modelo EcoNet v2.1 en línea', type: 'info', user: 'Sistema' },
  { time: '08:30', station: 'Todos', event: 'Inicio de jornada de recolección', type: 'info', user: 'Sistema' },
]

const navItems = [
  { icon: '📊', label: 'Inicio', active: true },
  { icon: '📍', label: 'Puntos de Acopio', active: false },
  { icon: '🤖', label: 'Reportes IA', active: false },
  { icon: '👥', label: 'Usuarios', active: false },
  { icon: '⚙️', label: 'Ajustes', active: false },
]

type NavItem = typeof navItems[number]

function AlertBadge({ type }: { type: string }) {
  const cfg: Record<string, string> = {
    success: 'bg-emerald-100 text-emerald-700',
    error: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
  }
  const label: Record<string, string> = {
    success: 'Validado', error: 'Alerta', warning: 'Advertencia', info: 'Sistema'
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg[type] ?? cfg.info}`}>
      {label[type] ?? type}
    </span>
  )
}

export default function AdminDashboard() {
  const [activeNav, setActiveNav] = useState('Inicio')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Sidebar */}
      <aside className={`bg-slate-900 flex flex-col transition-all duration-300 shrink-0 ${sidebarCollapsed ? 'w-16' : 'w-60'}`}>
        {/* Logo */}
        <div className="px-4 py-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
                <path d="M8 12l3 3 5-6"/>
              </svg>
            </div>
            {!sidebarCollapsed && (
              <div>
                <p className="text-white font-bold text-sm">EcoCampus</p>
                <p className="text-slate-400 text-xs">Admin Panel</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
          {navItems.map((item: NavItem) => (
            <button
              key={item.label}
              onClick={() => setActiveNav(item.label)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                activeNav === item.label
                  ? 'bg-emerald-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="text-base shrink-0">{item.icon}</span>
              {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* User + collapse */}
        <div className="border-t border-slate-700 p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0">MC</div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">María Contreras</p>
                <p className="text-slate-400 text-xs truncate">Coord. Sustentabilidad</p>
              </div>
            )}
            <button onClick={() => setSidebarCollapsed(p => !p)} className="text-slate-400 hover:text-white transition-colors shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {sidebarCollapsed
                  ? <path d="M9 18l6-6-6-6"/>
                  : <path d="M15 18l-6-6 6-6"/>
                }
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Tablero de Control</h1>
            <p className="text-slate-400 text-sm">Martes 23 de septiembre, 2026 · Semestre Otoño 2026</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-dot"/>
              <span className="text-xs font-semibold text-emerald-700">Modelo IA en línea</span>
            </div>
            <button className="relative w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors">
              <svg className="w-5 h-5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"/>
            </button>
          </div>
        </header>

        <div className="px-8 py-6 space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-4">
            {kpis.map(kpi => (
              <div key={kpi.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl">{kpi.icon}</div>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{kpi.change}</span>
                </div>
                <p className="text-xs text-slate-500 font-medium mb-1">{kpi.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-800 font-mono tracking-tight">{kpi.value}</span>
                  <span className="text-sm text-slate-400 font-medium">{kpi.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-5 gap-4">
            {/* Line chart */}
            <div className="col-span-3 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h3 className="font-bold text-slate-800">Volumen de reciclaje por franja horaria</h3>
                  <p className="text-slate-400 text-sm mt-0.5">Hoy · Martes 23 sep 2026</p>
                </div>
                <div className="flex gap-2">
                  {['Hoy', 'Semana', 'Mes'].map(p => (
                    <button key={p} className={`text-xs px-3 py-1.5 rounded-lg font-medium ${p === 'Hoy' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{p}</button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hora" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', fontSize: 12 }}
                    labelStyle={{ fontWeight: 700, color: '#1e293b' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
                  <Line type="monotone" dataKey="pet" name="PET (unidades)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="aluminio" name="Aluminio (unidades)" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3, fill: '#2563eb' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar chart */}
            <div className="col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
              <div className="mb-5">
                <h3 className="font-bold text-slate-800">Por facultad</h3>
                <p className="text-slate-400 text-sm mt-0.5">Kilogramos este mes</p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={facultadData} layout="vertical" barSize={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="nombre" type="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', fontSize: 12 }}
                  />
                  <Bar dataKey="pet" name="PET" fill="#10b981" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="aluminio" name="Aluminio" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Registro de actividad en tiempo real</h3>
                <p className="text-slate-400 text-sm mt-0.5">Eventos del sistema · Modelo EcoNet v2.1</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot"/>
                  <span>En vivo</span>
                </div>
                <button className="text-sm text-blue-600 font-semibold hover:text-blue-700">Exportar CSV</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Hora', 'Punto de Acopio', 'Evento', 'Tipo', 'Usuario'].map(h => (
                      <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {alerts.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3.5">
                        <span className="font-mono text-sm font-semibold text-slate-700">{row.time}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-sm text-slate-700 font-medium">{row.station}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-sm text-slate-600">{row.event}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <AlertBadge type={row.type} />
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-xs text-slate-500 font-mono">{row.user}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400">Mostrando 6 de 142 eventos hoy</p>
              <button className="text-xs text-blue-600 font-semibold">Ver historial completo →</button>
            </div>
          </div>

          {/* Bottom spacer */}
          <div className="h-4"/>
        </div>
      </main>
    </div>
  )
}
