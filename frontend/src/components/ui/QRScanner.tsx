'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2 } from 'lucide-react';

interface QRScannerProps {
  onScan: (result: string) => void;
  onError?: (err: string) => void;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'error'>('idle');
  const [errMsg,  setErrMsg]  = useState('');
  const readerRef = useRef<import('@zxing/browser').BrowserQRCodeReader | null>(null);
  const controlRef = useRef<{ stop: () => void } | null>(null);

  async function start() {
    setStatus('starting');
    setErrMsg('');
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      readerRef.current = reader;

      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      const deviceId = devices.find((d) =>
        d.label.toLowerCase().includes('back') ||
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment')
      )?.deviceId ?? devices[0]?.deviceId;

      if (!deviceId && devices.length === 0) {
        throw new Error('No camera found on this device.');
      }

      setStatus('scanning');

      const controls = await reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current!,
        (result, err) => {
          if (result) {
            onScan(result.getText());
          } else if (err && !(err.message?.includes('No MultiFormat'))) {
            // suppress continuous "no code found" noise
          }
        }
      );
      controlRef.current = controls as unknown as { stop: () => void };
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : '';
      // Map browser permission / availability errors to friendly messages
      let msg: string;
      if (/permission|notallowed|denied/i.test(raw)) {
        msg = 'Camera access was denied. Please allow camera permission in your browser settings and try again.';
      } else if (/notfound|devicenotfound|no camera/i.test(raw)) {
        msg = 'No camera found on this device. Use the manual entry below.';
      } else if (/notsupported|insecure|https/i.test(raw)) {
        msg = 'Camera requires a secure connection (HTTPS). Use manual entry instead.';
      } else {
        msg = raw || 'Camera unavailable. Use the manual entry below.';
      }
      setErrMsg(msg);
      setStatus('error');
      onError?.(msg);
    }
  }

  function stop() {
    controlRef.current?.stop();
    controlRef.current = null;
    readerRef.current = null;
    setStatus('idle');
  }

  useEffect(() => {
    return () => {
      controlRef.current?.stop();
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Video viewport */}
      <div
        className="relative w-full max-w-xs aspect-square rounded-2xl overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: '#000', border: '2px solid var(--border)' }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ display: status === 'scanning' ? 'block' : 'none' }}
          muted
          playsInline
        />

        {status !== 'scanning' && (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            {status === 'starting' ? (
              <Loader2 size={32} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            ) : status === 'error' ? (
              <CameraOff size={32} style={{ color: '#f87171' }} />
            ) : (
              <Camera size={32} style={{ color: 'var(--text-muted)' }} />
            )}
            <p className="text-xs leading-relaxed" style={{ color: status === 'error' ? '#fca5a5' : 'var(--text-muted)' }}>
              {status === 'starting' ? 'Starting camera…'
                : status === 'error' ? errMsg
                : 'Tap "Start scanning" to open the camera'}
            </p>
          </div>
        )}

        {/* Scan frame overlay */}
        {status === 'scanning' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              className="w-48 h-48 rounded-xl"
              style={{
                border: '2px solid rgba(255,255,255,0.7)',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
              }}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      {status === 'idle' || status === 'error' ? (
        <button
          onClick={start}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85"
          style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
        >
          <Camera size={16} />
          {status === 'error' ? 'Retry camera' : 'Start scanning'}
        </button>
      ) : status === 'scanning' ? (
        <button
          onClick={stop}
          className="text-sm px-4 py-2 rounded-xl border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--bg-sand)' }}
        >
          Stop camera
        </button>
      ) : null}

      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Point the camera at a child&apos;s QR card to open their record.
      </p>
    </div>
  );
}
