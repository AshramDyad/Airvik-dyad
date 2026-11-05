import { describe, expect, it, vi } from 'vitest';
import { POST } from './route';
const database = vi.hoisted(() => ({ abortSignal: vi.fn() }));
vi.mock('@/integrations/supabase/server', () => ({ createServerSupabaseClient: () => ({ rpc: () => database }) }));
describe('public pass validation', () => {
  it('returns only public fields even if the database result contains extra data', async () => {
    database.abortSignal.mockResolvedValue({ data: { valid: true, reason: 'Valid pass', room: '206', passNumber: 1, guestPhone: 'private' }, error: null });
    const response = await POST(new Request('https://example.test/api/bhojan/validate', { method: 'POST', body: JSON.stringify({ token: 'b0000000-0000-4000-8000-000000000001' }) }));
    expect(await response.json()).toEqual({ valid: true, reason: 'Valid pass', room: '206', passNumber: 1 });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('rejects malformed tokens without querying bookings', async () => {
    database.abortSignal.mockClear();
    const response = await POST(new Request('https://example.test/api/bhojan/validate', { method: 'POST', body: JSON.stringify({ token: 'A10001' }) }));
    expect(await response.json()).toEqual({ valid: false, reason: 'Invalid pass' });
    expect(database.abortSignal).not.toHaveBeenCalled();
  });
});
