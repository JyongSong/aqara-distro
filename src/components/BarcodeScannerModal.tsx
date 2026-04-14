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
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        // 1. 직접 getUserMedia — 해상도 높게, 연속 자동초점 요청
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1920 },
            height: { ideal: 1080 },
          },
        })

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        // 2. 자동초점(연속) 지원 여부 확인 후 적용
        const track = stream.getVideoTracks()[0]
        if (track) {
          const cap = track.getCapabilities?.() as Record<string, unknown> | undefined
          const modes = cap?.focusMode as string[] | undefined
          if (modes?.includes('continuous')) {
            await track.applyConstraints({
              // focusMode는 표준 타입에 없어서 캐스팅
              ...(({ focusMode: 'continuous' }) as MediaTrackConstraints),
            }).catch(() => {/* 지원 안 해도 무시 */})
          }
        }

        // 3. ZXing으로 디코딩 — decodeFromStream에 stream을 직접 전달
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const { DecodeHintType, BarcodeFormat } = await import('@zxing/library')

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

        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        const controls = await reader.decodeFromStream(
          stream,
          videoRef.current,
          (result) => {
            if (result) {
              controls.stop()
              stream.getTracks().forEach(t => t.stop())
              onScan(result.getText())
              onClose()
            }
          }
        )

        cleanupRef.current = () => {
          controls.stop()
          stream.getTracks().forEach(t => t.stop())
        }

        if (cancelled) cleanupRef.current()

      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        const isPerm = msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('notallowed') ||
          msg.toLowerCase().includes('denied')
        setError(
          isPerm
            ? '카메라 권한이 필요합니다.\n브라우저 설정에서 카메라를 허용해 주세요.'
            : `카메라를 열 수 없습니다: ${msg}`
        )
      }
    }

    start()

    return () => {
      cancelled = true
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClose = () => {
    cleanupRef.current?.()
    cleanupRef.current = null
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
              {/* 스캔 가이드 */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-red-400 rounded" style={{ width: '80%', height: '80px' }} />
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
