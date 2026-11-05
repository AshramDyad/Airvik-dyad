'use client';
import { useEffect, useRef, useState } from 'react';
import type QrScanner from 'qr-scanner';
import { validationSchema } from '@/lib/bhojan/types';

type Feedback = { kind: 'idle' | 'checking' | 'valid' | 'invalid' | 'error'; text: string };
const colors = { idle: '#111827', checking: '#854d0e', valid: '#15803d', invalid: '#b91c1c', error: '#854d0e' };
export default function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<QrScanner | null>(null);
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle', text: 'Point camera at a Bhojan pass' });
  const [needsStart, setNeedsStart] = useState(false);
  useEffect(() => {
    let disposed = false;
    let busy = false;
    let lastCode = '';
    let lastSeen = 0;
    let reset: ReturnType<typeof setTimeout> | undefined;
    let request: AbortController | undefined;
    const onScan = async (raw: string) => {
      const now = Date.now();
      const repeated = raw === lastCode && now - lastSeen < 1500;
      lastSeen = now;
      if (busy || repeated || disposed) return;
      lastCode = raw;
      if (reset) clearTimeout(reset);
      if (!/^bhojan:[0-9a-f-]{36}$/i.test(raw)) {
        setFeedback({ kind: 'invalid', text: 'Not a Bhojan pass' });
      } else {
        busy = true;
        request = new AbortController();
        const timeout = setTimeout(() => request?.abort(), 10000);
        setFeedback({ kind: 'checking', text: 'Checking…' });
        try {
          const response = await fetch('/api/bhojan/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: raw.slice(7) }), signal: request.signal, cache: 'no-store' });
          if (!response.ok) throw new Error('Validation unavailable');
          const data = validationSchema.parse(await response.json());
          if (!disposed) setFeedback({ kind: data.valid ? 'valid' : 'invalid', text: `${data.reason}${data.passNumber ? ` · Pass ${data.passNumber} · Room ${data.room ?? '—'}` : ''}` });
        } catch {
          if (!disposed) { setFeedback({ kind: 'error', text: 'No connection — remove pass, then scan again' }); }
        } finally { clearTimeout(timeout); busy = false; }
      }
      if (!disposed) reset = setTimeout(() => setFeedback({ kind: 'idle', text: 'Point camera at a Bhojan pass' }), 1400);
    };
    void import('qr-scanner').then(async ({ default: Camera }) => {
      if (disposed || !video.current) return;
      scanner.current = new Camera(video.current, result => void onScan(result.data), { preferredCamera: 'environment', maxScansPerSecond: 8, returnDetailedScanResult: true });
      try { await scanner.current.start(); }
      catch { if (!disposed) { setNeedsStart(true); setFeedback({ kind: 'error', text: 'Allow camera access to scan passes' }); } }
    }).catch(() => { if (!disposed) setFeedback({ kind: 'error', text: 'Could not load scanner. Reopen when connected.' }); });
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      void navigator.serviceWorker.register('/bhojan/sw.js', { scope: '/bhojan/' }).then(registration => {
        const cacheAssets = () => {
          const urls = performance.getEntriesByType('resource').map(entry => entry.name).filter(url => url.startsWith(`${location.origin}/_next/static/`));
          (registration.active ?? navigator.serviceWorker.controller)?.postMessage({ type: 'CACHE_ASSETS', urls });
        };
        setTimeout(cacheAssets, 3000);
        navigator.serviceWorker.addEventListener('controllerchange', cacheAssets, { once: true });
      }).catch(() => undefined);
    }
    return () => { disposed = true; request?.abort(); if (reset) clearTimeout(reset); scanner.current?.destroy(); scanner.current = null; };
  }, []);
  async function start() {
    try { await scanner.current?.start(); setNeedsStart(false); setFeedback({ kind: 'idle', text: 'Point camera at a Bhojan pass' }); }
    catch { setFeedback({ kind: 'error', text: 'Camera unavailable. Allow camera permission in browser settings.' }); }
  }
  return <main style={{ background: colors[feedback.kind], minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: 20 }}>
    <div style={{ width: 'min(85vw, 420px)', aspectRatio: '1', border: '4px solid white', borderRadius: 20, overflow: 'hidden', background: 'black' }}>
      <video ref={video} muted playsInline aria-label="Bhojan pass camera" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
    <p role="status" aria-live="polite" style={{ textAlign: 'center', marginTop: 24 }}>{feedback.text}</p>
    {needsStart && <button onClick={() => void start()} style={{ marginTop: 16, padding: 16, border: '1px solid white', borderRadius: 8 }}>Start camera</button>}
  </main>;
}
