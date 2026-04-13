'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
]

interface Props {
  onScan: (value: string) => void
  onClose: () => void
  label?: string
}

type Status = 'loading' | 'scanning' | 'error'

export default function BarcodeScannerModal({ onScan, onClose, label }: Props) {
  const [status, setStatus] = useState<Status>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [manualValue, setManualValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  // unique ID per mount to avoid DOM conflicts on reopen
  const containerIdRef = useRef(`qr-${Date.now()}`)

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch { /* already stopped */ }
      scannerRef.current = null
    }
  }, [])

  const startScanner = useCallback(async () => {
    setStatus('loading')
    setErrorMsg('')

    // Ensure the mount container exists
    if (!containerRef.current) return

    // Clear any previous content and create a fresh inner div
    containerRef.current.innerHTML = ''
    const inner = document.createElement('div')
    inner.id = containerIdRef.current
    containerRef.current.appendChild(inner)

    try {
      await stopScanner()

      const scanner = new Html5Qrcode(containerIdRef.current, {
        verbose: false,
        formatsToSupport: BARCODE_FORMATS,
      })
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 100 } },
        (decodedText) => {
          onScan(decodedText)
          stopScanner()
          onClose()
        },
        () => { /* scan miss — ignore */ }
      )

      setStatus('scanning')
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      const isPermission =
        raw.toLowerCase().includes('permission') ||
        raw.toLowerCase().includes('notallowed') ||
        raw.toLowerCase().includes('denied')

      setErrorMsg(
        isPermission
          ? '카메라 권한이 거부되었습니다.\n브라우저 주소창 왼쪽 자물쇠(🔒) 아이콘을 눌러 카메라를 허용한 뒤 다시 시도해 주세요.'
          : `카메라를 열 수 없습니다.\n(${raw})\n\n아래 수동 입력을 이용해 주세요.`
      )
      setStatus('error')
    }
  }, [onScan, onClose, stopScanner])

  useEffect(() => {
    startScanner()
    return () => { stopScanner() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClose = () => {
    stopScanner()
    onClose()
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = manualValue.trim()
    if (!v) return
    onScan(v)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">바코드 스캔</h3>
            {label && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[220px]">{label}</p>}
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scanner area */}
        <div className="px-4 pt-4">
          {/* Loading */}
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-teal-500 rounded-full animate-spin mb-3" />
              <p className="text-sm">카메라 시작 중...</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="py-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-3">
                <p className="text-sm text-red-700 font-medium mb-1">⚠ 카메라 오류</p>
                <p className="text-xs text-red-600 whitespace-pre-line leading-relaxed">{errorMsg}</p>
              </div>
              <button
                onClick={startScanner}
                className="w-full py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors"
              >
                🔄 카메라 다시 시도
              </button>
            </div>
          )}

          {/* Camera preview container — always in DOM so ref is valid */}
          <div
            ref={containerRef}
            className={status === 'scanning' ? 'w-full rounded-xl overflow-hidden' : 'hidden'}
            style={{ minHeight: status === 'scanning' ? '220px' : 0 }}
          />

          {status === 'scanning' && (
            <p className="text-xs text-gray-400 text-center mt-2 mb-1">
              바코드를 중앙 직사각형 안에 맞춰주세요
            </p>
          )}
        </div>

        {/* Manual input fallback — always visible */}
        <div className="px-4 pb-4 pt-3">
          <p className="text-xs font-medium text-gray-400 mb-2">— 직접 입력 —</p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="박스 ID 직접 입력"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!manualValue.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-700 hover:bg-gray-800 rounded-xl disabled:opacity-40 transition-colors"
            >
              확인
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
