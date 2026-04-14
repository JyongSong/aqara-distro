'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onScan: (value: string) => void
  onClose: () => void
  label?: string
}

export default function BarcodeScannerModal({ onScan, onClose, label }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // 탭 대상 좌표를 기반으로 포인트 오브 인터레스트 + single-shot 포커스
  const handleTapFocus = async (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const track = trackRef.current
    if (!track) return
    const el = videoRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    let clientX: number, clientY: number
    if ('touches' in e) {
      clientX = e.touches[0]?.clientX ?? rect.left + rect.width / 2
      clientY = e.touches[0]?.clientY ?? rect.top + rect.height / 2
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))

    try {
      // single-shot 포커스 → 잠시 후 continuous 복귀
      await track.applyConstraints({
        advanced: [{ pointsOfInterest: [{ x, y }], focusMode: 'single-shot' } as MediaTrackConstraints],
      })
      setTimeout(() => {
        track.applyConstraints({
          advanced: [{ focusMode: 'continuous' } as MediaTrackConstraints],
        }).catch(() => {})
      }, 800)
    } catch {
      // 지원 안 하는 기기에서는 무시
    }
  }

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        // 방안 A: getUserMedia 초기 요청에 focusMode 포함 (Android 삼성 등 대응)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1920 },
            height: { ideal: 1080 },
            ...({ focusMode: { ideal: 'continuous' } } as object),
          } as MediaTrackConstraints,
        })

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        // 방안 B: applyConstraints advanced 배열로 연속 AF 재적용
        const track = stream.getVideoTracks()[0]
        trackRef.current = track ?? null
        if (track) {
          const cap = track.getCapabilities?.() as Record<string, unknown> | undefined
          const modes = cap?.focusMode as string[] | undefined
          if (modes?.includes('continuous')) {
            await track.applyConstraints({
              advanced: [{ focusMode: 'continuous' } as MediaTrackConstraints],
            }).catch(() => {})
          }
        }

        // ZXing으로 디코딩
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
          trackRef.current = null
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
            <>
              {/* 방안 C: 화면 탭으로 수동 포커스 (Android 대응) */}
              <div
                className="relative rounded-xl overflow-hidden bg-black cursor-pointer"
                style={{ height: '280px' }}
                onClick={handleTapFocus}
                onTouchStart={handleTapFocus}
              >
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
              <p className="text-xs text-gray-400 text-center mt-2">
                화면을 탭하면 초점을 맞출 수 있습니다
              </p>
            </>
          )}
          <p className="text-xs text-gray-500 text-center mt-1">
            바코드를 빨간 테두리 안에 맞춰주세요
          </p>
        </div>
      </div>
    </div>
  )
}
