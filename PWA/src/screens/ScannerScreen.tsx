import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { Station } from '../lib/api'
import { api } from '../lib/api'

interface Props {
  onSuccess: (station: Station) => void
  onBack: () => void
}

function extractCode(value: string): string {
  try {
    const parsed = new URL(value)
    const queryCode = parsed.searchParams.get('codigo_qr') ?? parsed.searchParams.get('code')
    if (queryCode) return queryCode
    return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).at(-1) ?? value)
  } catch {
    return value.trim()
  }
}

export default function ScannerScreen({ onSuccess, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const handlingRef = useRef(false)
  const [manualCode, setManualCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!videoRef.current) return
    const reader = new BrowserMultiFormatReader()
    let controls: { stop: () => void } | undefined
    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _decodeError, activeControls) => {
      controls = activeControls
      if (!result || handlingRef.current) return
      handlingRef.current = true
      activeControls.stop()
      void verifyCode(result.getText())
    }).catch(reason => {
      setError(reason instanceof Error ? `No se pudo iniciar la cámara: ${reason.message}` : 'No se pudo iniciar la cámara.')
    })
    return () => controls?.stop()
  }, [])

  const verifyCode = async (rawCode: string) => {
    const code = extractCode(rawCode)
    if (!code) {
      handlingRef.current = false
      setError('No se encontró un código de estación en el QR.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const station = await api.station(code)
      onSuccess(station)
    } catch (reason) {
      handlingRef.current = false
      setError(reason instanceof Error ? reason.message : 'No se pudo validar esa estación.')
      setLoading(false)
    }
  }

  return (
    <section className="mx-auto max-w-lg p-5">
      <button onClick={onBack} className="mb-5 rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">← Regresar</button>
      <h1 className="text-2xl font-black">Escanea la estación</h1>
      <p className="mt-1 text-sm text-slate-500">Permite el acceso a la cámara y apunta al QR oficial de un punto activo.</p>

      <div className="relative mt-5 aspect-[4/3] overflow-hidden rounded-3xl bg-slate-950">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-emerald-400 shadow-[0_0_0_999px_rgba(2,6,23,0.25)]" />
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 font-bold text-white">Validando estación…</div>}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-bold">¿No tienes acceso a la cámara?</p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={event => { event.preventDefault(); handlingRef.current = true; void verifyCode(manualCode) }}
        >
          <input
            value={manualCode}
            onChange={event => setManualCode(event.target.value)}
            placeholder="Código de estación"
            aria-label="Código QR de estación"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <button disabled={!manualCode.trim() || loading} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Validar</button>
        </form>
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <p className="mt-4 text-xs leading-relaxed text-slate-400">La cámara y la ubicación requieren HTTPS en dispositivos móviles. El servidor comprobará que estés cerca de la estación al enviar la evidencia.</p>
    </section>
  )
}
