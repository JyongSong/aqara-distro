'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onScan: (value: string) => void
  onClose: () => void
  label?: string
}

export default function BarcodeScannerModal({ onScan, onClose, label }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const { DecodeHintType, BarcodeFormat } = await import('@zxing/library')

        if (cancelled || !videoRef.current) return

        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.ITF,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.QR_CODE,
        ])
        hints.set(DecodeHintType.TRY_HARDER, true)

        const reader = new BrowserMultiFormatReader(hints)

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err) => {
            if (result) {
              controls.stop()
              onScan(result.getText())
              onClose()
            } else if (err && err.name !== 'NotFoundException') {
              console.warn('scan error', err)
            }
          }
        )

        controlsRef.current = controls
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const isPermission = msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('notallowed') ||
          msg.toLowerCase().includes('denied')
        setError(
          isPermission
            ? '카메라 권한이 필요합니다.\n브라우저 설정에서 카메라를 허용해 주세요.'
            : `카메라를 열 수 없습니다: ${msg}`
        )
      }
    }

    start()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClose = () => {
    controlsRef.current?.stop()
    controlsRef.current = null
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900 text-base">바코드 스캔</h3>
            {label && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[220px]">{label}</p>}
          </div>
          <button onClick={handleClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Camera / error */}
        <div className="p-4">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black" style={{ height: '280px' }}>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
              {/* scanning guide line */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-4/5 border-2 border-red-400 rounded" style={{ height: '80px' }} />
              </div>
            </div>
          )}
          <p className="text-xs text-gray-500 text-center mt-3">
            바코드를 빨간 테두리 안에 맞춰주세요
          </p>
        </div>
      </div>
    </div>
  )
}
