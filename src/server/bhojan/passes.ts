import 'server-only';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { ImageResponse } from 'next/og';
import QRCode from 'qrcode';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/integrations/supabase/server';
import { HttpError } from '@/lib/server/auth';
import { normalizePhone } from '@/lib/whatsapp/cloud-api';
import { passSchema, passValidity, windowIsOpen, type PassPreview } from '@/lib/bhojan/types';

const rowSchema = z.object({ id: z.string(), booking_id: z.string(), guest_id: z.string().nullable(), room_id: z.string().nullable(), status: z.string(), check_in_date: z.string(), check_out_date: z.string() });
export async function loadPasses(id: string): Promise<PassPreview> {
  const db = createServerSupabaseClient();
  const selected = await db.from('reservations').select('booking_id').eq('id', id).single();
  if (selected.error) throw new HttpError(404, 'Booking not found.');
  const bookingId = z.object({ booking_id: z.string() }).parse(selected.data).booking_id;
  const rowsResult = await db.from('reservations').select('id,booking_id,guest_id,room_id,status,check_in_date,check_out_date', { count: 'exact' }).eq('booking_id', bookingId).range(0, 9999);
  if (rowsResult.error) throw rowsResult.error;
  const rows = z.array(rowSchema).parse(rowsResult.data);
  if (rows.length !== rowsResult.count) throw new HttpError(409, 'Could not load the complete booking.');
  const current = rows.filter(r => !['Cancelled', 'No-show'].includes(r.status));
  const guestIds = new Set(current.map(r => r.guest_id).filter(Boolean));
  if (guestIds.size !== 1) throw new HttpError(409, 'The booking needs one main guest.');
  const guestId = [...guestIds][0];
  const [guestResult, passResult, roomsResult] = await Promise.all([
    db.from('guests').select('phone').eq('id', guestId).single(),
    db.from('bhojan_passes').select('id,token,reservation_id,pass_number,revoked,send_state,message_id', { count: 'exact' }).eq('booking_id', bookingId).order('pass_number').range(0, 9999),
    db.from('rooms').select('id,room_number').in('id', rows.flatMap(r => r.room_id ? [r.room_id] : [])),
  ]);
  if (guestResult.error || passResult.error || roomsResult.error) throw guestResult.error ?? passResult.error ?? roomsResult.error;
  const rawPhone = z.object({ phone: z.string().nullable() }).parse(guestResult.data).phone ?? '';
  const phone = normalizePhone(rawPhone);
  const passes = z.array(passSchema).parse(passResult.data);
  if (passes.length !== passResult.count) throw new HttpError(409, 'Could not load all passes.');
  const rooms = z.array(z.object({ id: z.string(), room_number: z.string() })).parse(roomsResult.data);
  const windowResult = await db.from('whatsapp_inbound_windows').select('last_message_at').eq('sender', phone).eq('phone_number_id', process.env.WHATSAPP_PHONE_NUMBER_ID ?? '').maybeSingle();
  if (windowResult.error) throw windowResult.error;
  const inbound = z.object({ last_message_at: z.string() }).nullable().parse(windowResult.data);
  // Explicit configuration avoids confusing the API's phone-number ID with its dialable number.
  const businessPhone = process.env.WHATSAPP_BUSINESS_PHONE?.replace(/\D/g, '');
  const contactQr = businessPhone ? await QRCode.toDataURL(`https://wa.me/${businessPhone}?text=Hi`, { width: 240 }) : null;
  return {
    bookingId, phone: `+${phone}`, canIssue: current.some(r => ['Confirmed','Checked-in'].includes(r.status)),
    windowOpen: /^[1-9]\d{7,14}$/.test(phone) && windowIsOpen(inbound?.last_message_at), contactQr,
    previewToken: createHash('sha256').update(JSON.stringify([bookingId, phone, rows, passes.map(p => [p.id,p.revoked])])).digest('hex'),
    passes: passes.map(p => {
      const row = rows.find(r => r.id === p.reservation_id);
      if (!row) throw new HttpError(409, 'Pass reservation not found.');
      return { ...p, room: rooms.find(r => r.id === row.room_id)?.room_number ?? '—', ...passValidity(row, p.revoked) };
    }),
  };
}

export async function passImage(token: string, bookingId: string, passNumber: number, room: string): Promise<Blob> {
  const qr = await QRCode.toDataURL(`bhojan:${token}`, { width: 560, margin: 4, errorCorrectionLevel: 'M' });
  const element = createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'white', color: '#111', width: '100%', height: '100%', padding: 24, fontSize: 26 } },
    createElement('div', null, 'Sahajanand Wellness Trust'),
    createElement('div', { style: { fontSize: 36, marginTop: 12 } }, 'Bhojan pass'),
    createElement('img', { src: qr, width: 560, height: 560, alt: '' }),
    createElement('div', null, `${bookingId} • Pass ${passNumber} • Room ${room}`),
    createElement('div', { style: { marginTop: 12, fontSize: 18 } }, 'Valid according to your current booking and check-in.'),
  );
  return new ImageResponse(element, { width: 640, height: 780 }).blob();
}
