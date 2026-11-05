import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission, HttpError } from '@/lib/server/auth';
import { createServerSupabaseClient } from '@/integrations/supabase/server';
import { getEnvNumberConfig } from '@/lib/whatsapp/config';
import { sendWhatsAppImage } from '@/lib/whatsapp/cloud-api';
import { loadPasses, passImage } from '@/server/bhojan/passes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
const headers = { 'Cache-Control': 'private, no-store' };
const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('issue') }),
  z.object({ action: z.literal('send'), passId: z.string().uuid(), previewToken: z.string(), consent: z.literal(true), reviewedUncertain: z.boolean().default(false), resend: z.boolean().default(false) }),
]);
function failure(error: unknown) {
  if (error instanceof HttpError) return NextResponse.json({ message: error.message }, { status: error.status, headers });
  console.error('[Bhojan] Request failed', error instanceof Error ? error.message : 'Database request failed');
  return NextResponse.json({ message: 'Could not complete the pass request.' }, { status: 500, headers });
}
async function checkedId(context: Context) {
  const id = z.string().uuid().safeParse((await context.params).id);
  if (!id.success) throw new HttpError(400, 'Invalid reservation.');
  return id.data;
}
export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, 'update:reservation');
    return NextResponse.json(await loadPasses(await checkedId(context)), { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const actor = await requirePermission(request, 'update:reservation');
    const id = await checkedId(context);
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'Invalid pass request.');
    const input = parsed.data;
    const db = createServerSupabaseClient();
    if (input.action === 'issue') {
      const { error } = await db.rpc('issue_bhojan_passes', { p_id: id, p_actor: actor.userId });
      if (error) throw error;
      return NextResponse.json(await loadPasses(id), { headers });
    }
    const preview = await loadPasses(id);
    if (preview.previewToken !== input.previewToken) throw new HttpError(409, 'Booking changed. Refresh the pass preview.');
    if (!preview.windowOpen) throw new HttpError(409, 'Ask the guest to send Hi again.');
    const pass = preview.passes.find(p => p.id === input.passId && !p.revoked);
    if (!pass) throw new HttpError(409, 'This pass is no longer active.');
    if (pass.message_id && !input.resend) throw new HttpError(409, 'This pass was already submitted. Refresh before sending again.');
    if (['uncertain','sending'].includes(pass.send_state) && !input.reviewedUncertain) throw new HttpError(409, 'Check WhatsApp before resending this pass.');
    const config = getEnvNumberConfig();
    const image = await passImage(pass.token, preview.bookingId, pass.pass_number, pass.room);
    // Claim before external dispatch. A crashed request stays uncertain rather than being retried.
    let claim = db.from('bhojan_passes').update({ send_state: 'sending', sent_at: new Date().toISOString() }).eq('id', pass.id).eq('send_state', pass.send_state).eq('revoked', false);
    if (pass.send_state === 'sending') claim = claim.lt('sent_at', new Date(Date.now() - 60_000).toISOString());
    const claimed = await claim.select('id').maybeSingle();
    if (claimed.error) throw claimed.error;
    if (!claimed.data) throw new HttpError(409, 'Pass changed or another send is in progress. Refresh before retrying.');
    const result = await sendWhatsAppImage(preview.phone, image, `${preview.bookingId} — Bhojan pass ${pass.pass_number}, room ${pass.room}. Validity follows your current booking.`, { config, signal: AbortSignal.timeout(15_000) });
    const accepted = result.success && Boolean(result.messageId);
    const uncertain = result.success ? !result.messageId : Boolean(result.unconfirmed);
    const recorded = await db.from('bhojan_passes').update({
      send_state: accepted ? 'accepted' : uncertain ? 'uncertain' : 'failed',
      ...(accepted && result.success ? { message_id: result.messageId, sent_at: new Date().toISOString() } : {}),
    }).eq('id', pass.id);
    if (recorded.error) console.error('[Bhojan] Send state could not be recorded', { passId: pass.id });
    if (accepted) return NextResponse.json({ success: true, message: 'Pass submitted to WhatsApp.' }, { headers });
    return NextResponse.json({ message: uncertain ? 'Couldn’t confirm sending—check WhatsApp before retrying.' : 'WhatsApp did not accept this pass. Check the account and messaging window.' }, { status: uncertain ? 504 : 502, headers });
  } catch (error) { return failure(error); }
}
