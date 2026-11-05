import { z } from 'zod';

export const passSchema = z.object({
  id: z.string().uuid(), token: z.string().uuid(), reservation_id: z.string().uuid(),
  pass_number: z.number().int(), revoked: z.boolean(),
  send_state: z.enum(['new', 'sending', 'accepted', 'uncertain', 'failed']),
  message_id: z.string().nullable(),
});
export const validationSchema = z.object({ valid: z.boolean(), reason: z.string(), passNumber: z.number().optional(), room: z.string().nullable().optional() });
export const previewSchema = z.object({
  bookingId: z.string(), phone: z.string(), previewToken: z.string(), windowOpen: z.boolean(),
  contactQr: z.string().nullable(), canIssue: z.boolean(),
  passes: z.array(passSchema.extend({ room: z.string(), reason: z.string(), valid: z.boolean() })),
});
export type PassPreview = z.infer<typeof previewSchema>;
export type BhojanPass = z.infer<typeof passSchema>;
export function passValidity(reservation: { status: string; check_in_date: string; check_out_date: string }, revoked: boolean, now = new Date()) {
  const ends = Date.parse(`${reservation.check_out_date}T11:59:00+05:30`);
  if (revoked) return { valid: false, reason: 'Pass no longer active' };
  if (now.getTime() >= ends) return { valid: false, reason: 'Pass expired' };
  if (reservation.status !== 'Checked-in') return { valid: false, reason: 'Not checked in' };
  return { valid: true, reason: 'Valid pass' };
}
export function windowIsOpen(timestamp: string | undefined, now = Date.now()) {
  if (!timestamp) return false;
  const time = Date.parse(timestamp);
  return time <= now && now - time < 24 * 60 * 60 * 1000;
}
