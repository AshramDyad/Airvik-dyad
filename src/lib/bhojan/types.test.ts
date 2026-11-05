import { describe, expect, it } from 'vitest';
import { buildReservation } from '@/test/builders';
import { passValidity, windowIsOpen } from './types';

function fixture(status = 'Checked-in') {
  const reservation = buildReservation({ checkInDate: '2026-11-05', checkOutDate: '2026-11-07' });
  return { status, check_in_date: reservation.checkInDate, check_out_date: reservation.checkOutDate };
}
describe('Bhojan validity', () => {
  it('expires at 11:59 AM India time, not midnight', () => {
    expect(passValidity(fixture(), false, new Date('2026-11-07T06:28:59Z')).valid).toBe(true);
    expect(passValidity(fixture(), false, new Date('2026-11-07T06:29:00Z')).reason).toBe('Pass expired');
  });
  it('requires both arrival date and check-in', () => {
    expect(passValidity(fixture(), false, new Date('2026-11-04T18:29:59Z')).valid).toBe(false);
    expect(passValidity(fixture(), false, new Date('2026-11-04T18:30:00Z')).valid).toBe(true);
    expect(passValidity(fixture('Confirmed'), false, new Date('2026-11-05T12:00:00Z')).valid).toBe(false);
  });
  it('rejects checked-out and revoked passes', () => {
    const now = new Date('2026-11-05T12:00:00Z');
    expect(passValidity(fixture('Checked-out'), false, now).valid).toBe(false);
    expect(passValidity(fixture(), true, now).valid).toBe(false);
  });
  it('requires a known incoming message less than 24 hours old', () => {
    const now = Date.parse('2026-11-05T12:00:00Z');
    expect(windowIsOpen(undefined, now)).toBe(false);
    expect(windowIsOpen('2026-11-04T12:00:00Z', now)).toBe(false);
    expect(windowIsOpen('2026-11-04T12:00:01Z', now)).toBe(true);
    expect(windowIsOpen('2026-11-06T12:00:00Z', now)).toBe(false);
  });
});
