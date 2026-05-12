'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2 } from 'lucide-react';

interface QRScannerProps {
  onScan: (result: string) => void;
  onError?: (err: string) => void;
}

// Extend window type for BarcodeDetector (Chrome/Edge native API)
declare global {
  interface Window {
    BarcodeDetector?: {
      new(options: { formats: string[] }): {
        detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
      };
    };
  }
}

function friendlyError(raw: string): string {
  if (/permission|notallowed|denied/i.test(raw))
    return 'Camera access was denied. Click the camera icon in your browser address bar and allow access, then retry.';
  if (/notfound|devicenotfound|no camera/i.test(raw))
    return 'No camera found on this device. Use the manual entry below.';
  if (/notsupported|insecure|https/i.test(raw))
    return 'Camera requires a secure connection. Use the manual entry below.';
  if (/overconstrained|constraint/i.test(raw))
    return 'Camera constraints not supported. Trying again…';
  return raw || 'Camera unavailable. Use the manual entry below.';
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number | null>(null);
  const detectorRef = useRef<{ detect(v: HTMLVideoElement): Promise<Array<{ rawValue: string }>> } | null>(null);
  const scannedRef = useRef(false);

  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'error'>('idle');
  const [errMsg,  setErrMsg]  = useState('');

  function stopAll() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    detectorRef.current = null;
    scannedRef.current = false;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function start() {
    setStatus('starting');
    setErrMsg('');
    scannedRef.current = false;

    try {
      // ── 1. Get camera stream ──────────────────────────────────────────
      const constraints: MediaStreamConstraints = {
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (!videoRef.current) throw new Error('Video element not ready.');
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStatus('scanning');

      // ── 2. Pick scanner: native BarcodeDetector → @zxing fallback ────
      if (typeof window !== 'undefined' && window.BarcodeDetector) {
        // Native API — Chrome 83+, Edge 83+ (fast, no library needed)
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        detectorRef.current = detector;

        const tick = async () => {
          if (!videoRef.current || scannedRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0 && !scannedRef.current) {
              scannedRef.current = true;
              onScan(barcodes[0].rawValue);
              return; // stop ticking after first successful scan
            }
          } catch {
            // frame not ready yet — keep ticking
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);

      } else {
        // Fallback: @zxing/browser (Firefox / older browsers)
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const reader = new BrowserQRCodeReader();

        // Attach to the already-playing stream instead of requesting a new one
        const controls = await reader.decodeFromStream(
          stream,
          videoRef.current,
          (result) => {
            if (result && !scannedRef.current) {
              scannedRef.current = true;
              onScan(result.getText());
            }
          },
        );
        // Store stop handle in rafRef slot for cleanup
        rafRef.current = -1;
        const originalStop = stopAll;
        streamRef.current = stream;
        // Override stopAll to also call zxing controls.stop()
        const zxingControls = controls as unknown as { stop(): void };
        detectorRef.current = {
          detect: async () => [],
        };
        // Wrap cleanup
        const origStopAll = stopAll.bind(null);
        void origStopAll; // unused but keeps lint happy
        const cleanup = () => { zxingControls.stop(); originalStop(); };
        // Replace stop references
        (streamRef as unknown as { _cleanup: () => void })._cleanup = cleanup;
      }

    } catch (err: unknown) {
      stopAll();
      const raw = err instanceof Error ? err.message : String(err);
      const msg = friendlyError(raw);
      setErrMsg(msg);
      setStatus('error');
      onError?.(msg);
    }
  }

  function stop() {
    // Call zxing cleanup if it was set
    const s = streamRef as unknown as { _cleanup?: () => void };
    if (s._cleanup) { s._cleanup(); s._cleanup = undefined; }
    else stopAll();
    setStatus('idle');
  }

  useEffect(() => {
    return () => {
      const s = streamRef as unknown as { _cleanup?: () => void };
      if (s._cleanup) { s._cleanup(); s._cleanup = undefined; }
      else stopAll();
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
          autoPlay
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
            <p className="text-xs leading-relaxed max-w-[200px]"
              style={{ color: status === 'error' ? '#fca5a5' : 'var(--text-muted)' }}
            >
              {status === 'starting'
                ? 'Starting camera…'
                : status === 'error'
                  ? errMsg
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
                border: '2px solid rgba(255,255,255,0.8)',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
              }}
            />
            {/* Corner marks */}
            {(['tl','tr','bl','br'] as const).map((pos) => (
              <div
                key={pos}
                className="absolute w-5 h-5"
                style={{
                  top:    pos.startsWith('t') ? 'calc(50% - 96px)' : undefined,
                  bottom: pos.startsWith('b') ? 'calc(50% - 96px)' : undefined,
                  left:   pos.endsWith('l')   ? 'calc(50% - 96px)' : undefined,
                  right:  pos.endsWith('r')   ? 'calc(50% - 96px)' : undefined,
                  borderTop:    pos.startsWith('t') ? '3px solid #4ade80' : undefined,
                  borderBottom: pos.startsWith('b') ? '3px solid #4ade80' : undefined,
                  borderLeft:   pos.endsWith('l')   ? '3px solid #4ade80' : undefined,
                  borderRight:  pos.endsWith('r')   ? '3px solid #4ade80' : undefined,
                }}
              />
            ))}
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
        Point the camera at a child&apos;s QR card. Detection is automatic.
      </p>
    </div>
  );
}
