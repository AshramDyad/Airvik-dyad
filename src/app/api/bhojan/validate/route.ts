import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/integrations/supabase/server';
import { validationSchema } from '@/lib/bhojan/types';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  const input = z.object({ token: z.string().uuid() }).strict().safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ valid: false, reason: 'Invalid pass' }, { headers });
  try {
    const { data, error } = await createServerSupabaseClient().rpc('validate_bhojan_pass', { p_token: input.data.token }).abortSignal(AbortSignal.timeout(8000));
    if (error) throw error;
    return NextResponse.json(validationSchema.parse(data), { headers });
  } catch {
    return NextResponse.json({ message: 'Could not check pass. Try again.' }, { status: 503, headers });
  }
}
