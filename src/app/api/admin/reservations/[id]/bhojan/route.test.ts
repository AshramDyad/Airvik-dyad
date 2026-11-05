import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';
import { HttpError, requirePermission } from '@/lib/server/auth';
import { loadPasses } from '@/server/bhojan/passes';
import { sendWhatsAppImage } from '@/lib/whatsapp/cloud-api';

vi.mock('@/lib/server/auth', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/server/auth')>(), requirePermission: vi.fn() }));
vi.mock('@/server/bhojan/passes', () => ({ loadPasses: vi.fn(), passImage: vi.fn().mockResolvedValue(new Blob(['image'], { type: 'image/png' })) }));
vi.mock('@/lib/whatsapp/cloud-api', () => ({ sendWhatsAppImage: vi.fn() }));
vi.mock('@/lib/whatsapp/config', () => ({ getEnvNumberConfig: () => ({ phoneNumberId: 'number' }) }));
const database = vi.hoisted(() => ({ rpc: vi.fn(), maybeSingle: vi.fn(), select: vi.fn(), eq: vi.fn(), update: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/server', () => ({ createServerSupabaseClient: () => database }));
const id = 'b0000000-0000-4000-8000-000000000001';
const context = { params: Promise.resolve({ id }) };
const preview = () => ({ bookingId: 'A10001', phone: '+919999999999', previewToken: 'preview', windowOpen: true, contactQr: null, canIssue: true, passes: [{ id, token: id, reservation_id: id, pass_number: 1, revoked: false, send_state: 'new' as const, message_id: null, room: '206', valid: true, reason: 'Valid pass' }] });
const request = () => new Request('https://example.test/api/admin/reservations/test/bhojan', { method: 'POST', body: JSON.stringify({ action: 'send', passId: id, previewToken: 'preview', consent: true }) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue({ userId: id, roleName: 'Admin', permissions: ['update:reservation'] });
  vi.mocked(loadPasses).mockResolvedValue(preview());
  database.from.mockReturnValue(database); database.update.mockReturnValue(database); database.eq.mockReturnValue(database); database.select.mockReturnValue(database);
  database.maybeSingle.mockResolvedValue({ data: { id }, error: null });
});
describe('Bhojan staff endpoint', () => {
  it('rejects missing permission before accessing passes', async () => {
    vi.mocked(requirePermission).mockRejectedValue(new HttpError(403, 'Insufficient permissions'));
    expect((await GET(request(), context)).status).toBe(403);
    expect(loadPasses).not.toHaveBeenCalled();
  });
  it('rejects expired WhatsApp windows without sending', async () => {
    vi.mocked(loadPasses).mockResolvedValue({ ...preview(), windowOpen: false });
    expect((await POST(request(), context)).status).toBe(409);
    expect(sendWhatsAppImage).not.toHaveBeenCalled();
  });
  it('uses the server recipient and sends exactly one selected image', async () => {
    vi.mocked(sendWhatsAppImage).mockResolvedValue({ success: true, messageId: 'wamid.test' });
    expect((await POST(request(), context)).status).toBe(200);
    expect(sendWhatsAppImage).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppImage).toHaveBeenCalledWith('+919999999999', expect.any(Blob), expect.stringContaining('Pass'.toLowerCase()), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(database.update).toHaveBeenCalledWith(expect.objectContaining({ send_state: 'accepted', message_id: 'wamid.test' }));
  });
  it('records uncertain results and never retries', async () => {
    vi.mocked(sendWhatsAppImage).mockResolvedValue({ success: false, error: 'timeout', unconfirmed: true });
    expect((await POST(request(), context)).status).toBe(504);
    expect(sendWhatsAppImage).toHaveBeenCalledTimes(1);
    expect(database.update).toHaveBeenCalledWith({ send_state: 'uncertain' });
  });
});
