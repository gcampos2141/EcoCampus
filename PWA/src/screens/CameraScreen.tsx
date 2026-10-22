import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { api, type DepositResponse, type Station } from '../lib/api'

interface Props {
  station: Station
  onBack: () => void
  onComplete: (result: DepositResponse) => void | Promise<void>
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Este dispositivo no permite obtener la ubicación.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, () => {
      reject(new Error('Necesitamos tu ubicación para validar que estás en la estación. Activa el permiso de ubicación e inténtalo de nuevo.'))
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  })
}

export default function CameraScreen({ station, onBack, onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef('')
  const [cameraError, setCameraError] = useState('')
  const [image, setImage] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [result, setResult] = useState<DepositResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (image) return
    let mounted = true
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('La cámara no está disponible en este navegador. Puedes seleccionar una foto.')
      return
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(stream => {
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        streamRef.current = stream
        setCameraError('')
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setCameraError('No se pudo abrir la cámara. Revisa los permisos o selecciona una foto.'))
    return () => {
      mounted = false
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [image])

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  const submitImage = async (selectedImage: Blob, filename: string) => {
    setError('')
    setResult(null)
    setImage(selectedImage)
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = URL.createObjectURL(selectedImage)
    setPreviewUrl(previewUrlRef.current)
    setLoading(true)
    try {
      const position = await getPosition()
      const response = await api.submitEvidence(
        selectedImage,
        filename,
        station,
        position.coords.latitude,
        position.coords.longitude,
      )
      setResult(response)
      await onComplete(response)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo procesar la fotografía.')
    } finally {
      setLoading(false)
    }
  }

  const capture = async () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) {
      setError('La cámara aún no está lista. Espera un momento o selecciona una foto.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) {
      setError('No se pudo capturar la imagen. Inténtalo otra vez.')
      return
    }
    await submitImage(blob, `evidencia-${Date.now()}.jpg`)
  }

  const chooseImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (selected) await submitImage(selected, selected.name)
    event.target.value = ''
  }

  const resetCapture = () => {
    setImage(null)
    setResult(null)
    setError('')
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = ''
    setPreviewUrl('')
  }

  const accepted = result?.evidencia.estado === 'ACEPTADO' && result.deposito !== null

  return (
    <section className="mx-auto max-w-lg p-5">
      <button onClick={onBack} className="mb-5 rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">← Cambiar estación</button>
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Estación verificada</p>
      <h1 className="mt-1 text-2xl font-black">{station.nombre_estacion}</h1>
      <p className="mt-1 text-sm text-slate-500">Coloca una sola botella PET o lata dentro del encuadre.</p>

      <div className="relative mt-5 overflow-hidden rounded-3xl bg-slate-950">
        {previewUrl ? (
          <div className="relative">
            <img src={previewUrl} alt="Fotografía enviada para validar el reciclaje" className="block h-auto w-full" />
            {result?.evidencia.detecciones.map((detection, index) => {
              const [x1, y1, x2, y2] = detection.caja_normalizada
              return (
                <div
                  key={`${detection.clase}-${index}`}
                  className="absolute border-2 border-emerald-400"
                  style={{ left: `${x1 * 100}%`, top: `${y1 * 100}%`, width: `${(x2 - x1) * 100}%`, height: `${(y2 - y1) * 100}%` }}
                >
                  <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {detection.clase} · {(detection.confianza * 100).toFixed(0)}%
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="block aspect-[4/3] w-full object-cover" />
            <div className="pointer-events-none absolute inset-[12%] rounded-3xl border-2 border-dashed border-emerald-400/80" />
          </>
        )}
      </div>

      {!image && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => void capture()}
            disabled={loading}
            className="rounded-2xl bg-emerald-600 px-4 py-3.5 font-bold text-white shadow-lg shadow-emerald-200 disabled:opacity-50"
          >
            Tomar fotografía
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="rounded-2xl border border-slate-200 px-4 py-3.5 font-bold text-slate-700 disabled:opacity-50"
          >
            Elegir imagen
          </button>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={event => void chooseImage(event)} className="hidden" />
        </div>
      )}

      {cameraError && !image && <p className="mt-3 text-xs text-amber-700">{cameraError}</p>}
      {loading && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-800">Validando ubicación y analizando con el modelo…</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {result && (
        <div className={`mt-4 rounded-2xl border p-4 ${accepted ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className="font-bold">{accepted ? 'Reciclaje validado' : 'No se registró el depósito'}</p>
          <p className="mt-1 text-sm">{result.evidencia.mensaje}</p>
          {accepted && <p className="mt-2 text-lg font-black text-emerald-700">+{result.puntos_otorgados} puntos</p>}
          <p className="mt-1 text-xs text-slate-500">
            {result.evidencia.material} · Confianza {(result.evidencia.confianza * 100).toFixed(1)}%
          </p>
        </div>
      )}

      {image && !loading && (
        <button onClick={resetCapture} className="mt-4 w-full rounded-xl border border-slate-200 py-3 font-semibold text-slate-700">
          Tomar otra fotografía
        </button>
      )}
      <p className="mt-4 text-xs leading-relaxed text-slate-400">Solo se acreditan PET y latas de aluminio aceptados por el modelo. El servicio no guarda la foto en el servidor; registra el pHash de prevención de duplicados.</p>
    </section>
  )
}
