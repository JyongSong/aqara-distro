'use client'

import { useEffect, useRef } from 'react'
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

export default function BarcodeScannerModal({ onScan, onClose, label }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerId = 'barcode-scanner-container'

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId, {
      verbose: false,
      formatsToSupport: BARCODE_FORMATS,
    })
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 120 },
        },
        (decodedText) => {
          onScan(decodedText)
          scanner.stop().catch(() => {})
          onClose()
        },
        () => {
          // scan error - ignore
        }
      )
      .catch((err) => {
        console.error('Camera start error:', err)
      })

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900 text-base">바코드 스캔</h3>
            {label && <p className="text-xs text-gray-500 mt-0.5">{label}</p>}
          </div>
          <button
            onClick={() => {
              if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {})
                scannerRef.current = null
              }
              onClose()
            }}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scanner area */}
        <div className="p-4">
          <div
            id={containerId}
            className="w-full rounded-xl overflow-hidden bg-gray-900"
            style={{ minHeight: '240px' }}
          />
          <p className="text-xs text-gray-500 text-center mt-3">
            바코드를 카메라 중앙에 맞춰주세요
          </p>
        </div>
      </div>
    </div>
  )
}
