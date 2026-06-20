import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { X, Camera, AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLastCode(null);
    const reader = new BrowserMultiFormatReader();

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (devices.length === 0) {
          setError('لم يتم العثور على كاميرا');
          return;
        }
        const back = devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[0];
        const controls = await reader.decodeFromVideoDevice(
          back.deviceId,
          videoRef.current!,
          (result, err) => {
            if (result) {
              const code = result.getText();
              setLastCode(code);
              onDetected(code);
            }
            void err;
          }
        );
        controlsRef.current = controls;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'فشل تشغيل الكاميرا');
      }
    })();

    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-surface)] border border-line rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h3 className="font-bold text-ink flex items-center gap-2">
            <Camera className="w-5 h-5 text-ink/50" />
            ماسح الباركود
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative bg-black aspect-video">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 gap-2 p-6">
              <AlertTriangle className="w-10 h-10" />
              <p className="text-center text-sm">{error}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-3/4 h-1/3 border-2 border-amber-400 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
              </div>
            </>
          )}
        </div>

        <div className="p-4 text-center">
          {lastCode ? (
            <div className="text-green-400 font-mono text-sm">آخر باركود: {lastCode}</div>
          ) : (
            <div className="text-gray-400 text-sm">وجّه الكاميرا نحو الباركود</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BarcodeScanner;
