'use client';
import { useRef, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { z } from 'zod';
import { authorizedFetch } from '@/lib/auth/client-session';
import { previewSchema, type PassPreview } from '@/lib/bhojan/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function BhojanPasses({ reservationId }: { reservationId: string }) {
  const [preview, setPreview] = useState<PassPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'new' | 'all' | null>(null);
  const [consent, setConsent] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const url = `/api/admin/reservations/${reservationId}/bhojan`;
  async function request(body?: object): Promise<unknown> {
    const response = await authorizedFetch(url, { method: body ? 'POST' : 'GET', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000), retryOnUnauthorized: false });
    const result: unknown = await response.json();
    if (!response.ok) {
      const error = z.object({ message: z.string() }).safeParse(result);
      throw new Error(error.success ? error.data.message : 'Could not complete request.');
    }
    return result;
  }
  async function load(issue = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try { setPreview(previewSchema.parse(await request(issue ? { action: 'issue' } : undefined))); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load passes.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const selected = preview?.passes.filter(pass => !pass.revoked && (mode === 'all' || (!pass.message_id && !['sending','uncertain'].includes(pass.send_state)))) ?? [];
  const hasUncertain = selected.some(pass => ['sending','uncertain'].includes(pass.send_state));
  async function send() {
    if (lock.current || !preview || !consent || (hasUncertain && !reviewed)) return;
    lock.current = true; setBusy(true); setMessage('');
    let accepted = 0;
    try {
      for (const pass of selected) {
        setMessage(`Sending pass ${pass.pass_number}…`);
        const result = await request({ action: 'send', passId: pass.id, previewToken: preview.previewToken, consent: true, reviewedUncertain: reviewed, resend: mode === 'all' });
        if (!z.object({ success: z.literal(true) }).safeParse(result).success) throw new Error('Couldn’t confirm sending—check WhatsApp before retrying.');
        accepted++;
      }
      setMessage(`${accepted} passes submitted to WhatsApp.`); setMode(null);
    } catch (error) {
      setMessage(`${accepted} submitted. ${error instanceof Error ? error.message : 'Couldn’t confirm sending—check WhatsApp before retrying.'}`);
      setMode(null);
    } finally {
      try { setPreview(previewSchema.parse(await request())); } catch { /* Preserve the send outcome if refresh fails. */ }
      lock.current = false; setBusy(false);
    }
  }
  function openSend(next: 'new' | 'all') { setConsent(false); setReviewed(false); setMode(next); }
  return <Card>
    <CardHeader><CardTitle>Bhojan passes</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">One pass per guest, including children. Works after check-in until 11:59 AM on departure day or earlier checkout.</p>
      <Button variant="outline" disabled={busy} onClick={() => void load()}> {preview ? 'Refresh passes' : 'Open passes'} </Button>
      {preview && <>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !preview.canIssue} onClick={() => void load(true)}>Issue passes</Button>
          <Button variant="outline" disabled={busy || !preview.windowOpen || !preview.passes.some(p => !p.revoked && !p.message_id && !['sending','uncertain'].includes(p.send_state))} onClick={() => openSend('new')}><FaWhatsapp className="mr-2" aria-hidden />Send new passes</Button>
          <Button variant="outline" disabled={busy || !preview.windowOpen || !preview.passes.some(p => !p.revoked)} onClick={() => openSend('all')}>Send all passes</Button>
        </div>
        <p className="text-sm">Main guest: {preview.phone}. {preview.windowOpen ? 'WhatsApp messaging window is open.' : 'Ask the guest to send Hi again.'}</p>
        {preview.contactQr && <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.contactQr} width={180} height={180} alt="Scan to open our WhatsApp and send Hi" />
          <figcaption className="text-sm">Scan to open WhatsApp, then press Send on “Hi”. This is not a meal pass.</figcaption>
        </figure>}
        {!preview.contactQr && <p className="text-sm">Business WhatsApp contact QR is not configured yet.</p>}
        <ul className="max-h-72 space-y-2 overflow-auto text-sm">{preview.passes.map(pass => <li key={pass.id}>
          Pass {pass.pass_number} · Room {pass.room} · {pass.reason} · {pass.send_state === 'sending' || pass.send_state === 'uncertain' ? 'Check WhatsApp before resending' : pass.send_state === 'accepted' ? 'Submitted to WhatsApp' : pass.send_state}
        </li>)}</ul>
        {!preview.passes.length && <p>No passes issued yet.</p>}
      </>}
      {message && <p role="status" className="text-sm">{message}</p>}
      <Dialog open={mode !== null} onOpenChange={open => { if (!open && !busy) setMode(null); }}>
        <DialogContent onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}>
          <DialogHeader><DialogTitle>Send Bhojan passes</DialogTitle><DialogDescription>{selected.length} individual pass images to {preview?.phone}. The main guest can forward each pass.</DialogDescription></DialogHeader>
          <p className="text-sm">{preview?.bookingId}: {selected.map(p => `Pass ${p.pass_number} (room ${p.room})`).join(', ')}. Validity follows the current booking.</p>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} />The guest agreed to receive these passes.</label>
          {hasUncertain && <label className="flex gap-2 text-sm"><input type="checkbox" checked={reviewed} disabled={busy} onChange={e => setReviewed(e.target.checked)} />I checked WhatsApp and deliberately want to resend passes with an uncertain outcome.</label>}
          <Button disabled={busy || !consent || !selected.length || (hasUncertain && !reviewed)} onClick={() => void send()}>{busy ? 'Sending…' : 'Send'}</Button>
          {busy && <p role="status">{message}</p>}
        </DialogContent>
      </Dialog>
    </CardContent>
  </Card>;
}
