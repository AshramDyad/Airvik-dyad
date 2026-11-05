"use client";

import * as React from "react";
import { FaWhatsapp } from "react-icons/fa";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { authorizedFetch } from "@/lib/auth/client-session";

const previewSchema = z.object({ phone: z.string(), message: z.string(), previewToken: z.string() });
const errorSchema = z.object({ message: z.string() });
const sentSchema = z.object({ success: z.literal(true) });
type Preview = z.infer<typeof previewSchema>;

export function SendBookingConfirmationButton({ reservationId, disabledReason }: { reservationId: string; disabledReason?: string }) {
  const [open, setOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [consent, setConsent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const sendLock = React.useRef(false);
  const previewRequest = React.useRef(0);
  const reasonId = React.useId();
  const url = `/api/admin/reservations/${reservationId}/send-confirmation`;

  async function changeOpen(nextOpen: boolean) {
    if (sendLock.current) return;
    setOpen(nextOpen);
    setPreview(null);
    setConsent(false);
    setError(null);
    const current = ++previewRequest.current;
    if (!nextOpen) { setLoading(false); return; }
    setLoading(true);
    try {
      const response = await authorizedFetch(url, { retryOnUnauthorized: false, signal: AbortSignal.timeout(15_000) });
      const body: unknown = await response.json();
      if (current !== previewRequest.current) return;
      if (!response.ok) {
        const parsed = errorSchema.safeParse(body);
        setError(parsed.success ? parsed.data.message : "Could not load the confirmation.");
      } else {
        const parsed = previewSchema.safeParse(body);
        if (parsed.success) setPreview(parsed.data);
        else setError("Could not load the confirmation.");
      }
    } catch {
      if (current === previewRequest.current) setError("Could not load the confirmation. Close and try again.");
    } finally {
      if (current === previewRequest.current) setLoading(false);
    }
  }

  async function send() {
    if (sendLock.current || !consent || !preview) return;
    sendLock.current = true;
    setSending(true);
    setError(null);
    try {
      const response = await authorizedFetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true, previewToken: preview.previewToken }),
        signal: AbortSignal.timeout(25_000), retryOnUnauthorized: false,
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const parsed = errorSchema.safeParse(body);
        setError(parsed.success ? parsed.data.message : "Couldn't confirm sending—check WhatsApp before retrying.");
        return;
      }
      if (!sentSchema.safeParse(body).success) {
        setError("Couldn't confirm sending—check WhatsApp before retrying.");
        return;
      }
      toast.success("Confirmation submitted to WhatsApp.");
      setOpen(false);
      setPreview(null);
      setConsent(false);
    } catch {
      setError("Couldn't confirm sending—check WhatsApp before retrying.");
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => void changeOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={Boolean(disabledReason)} title={disabledReason} aria-describedby={disabledReason ? reasonId : undefined}>
          <FaWhatsapp aria-hidden="true" className="mr-2 h-4 w-4" /> Send confirmation
        </Button>
      </DialogTrigger>
      {disabledReason && <span id={reasonId} className="sr-only">{disabledReason}</span>}
      <DialogContent aria-busy={loading || sending} onEscapeKeyDown={(event) => { if (sending) event.preventDefault(); }} onPointerDownOutside={(event) => { if (sending) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Send booking confirmation</DialogTitle>
          <DialogDescription>Review the guest’s number and message before sending.</DialogDescription>
        </DialogHeader>
        {loading && <p role="status">Loading confirmation…</p>}
        {preview && <>
          <p className="text-sm"><strong>WhatsApp number:</strong> {preview.phone}</p>
          <p className="whitespace-pre-line rounded-xl border p-4 text-sm">{preview.message}</p>
          <label className="flex items-start gap-2 text-sm" htmlFor="whatsapp-consent">
            <Checkbox id="whatsapp-consent" checked={consent} onCheckedChange={(value) => setConsent(value === true)} disabled={sending} />
            <span>The guest agreed to receive booking messages on WhatsApp.</span>
          </label>
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => void changeOpen(false)} disabled={sending}>Cancel</Button>
          <Button type="button" onClick={() => void send()} disabled={!preview || !consent || sending}>
            {sending && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
