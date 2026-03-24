import { NextResponse } from "next/server";
import { z } from "zod";

import type { ManualReceipt } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { requireFeature, HttpError } from "@/lib/server/auth";

const PAYMENT_METHODS = [
  "Cash",
  "UPI",
  "Bank/IMPS",
  "Bhagat Ji",
  "Anurag Ji",
] as const;

const UpdateSchema = z.object({
  // New fields
  fullName: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  pancard: z.string().optional().nullable(),
  aadharCard: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  trust: z.string().optional().nullable(),
  donationType: z.string().optional().nullable(),
  donationIn: z.string().optional().nullable(),
  paymentMode: z.string().optional().nullable(),
  // Legacy fields
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  email: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.union([z.literal(""), z.string().email()]))
    .optional(),
  address: z.string().optional().nullable(),
  amount: z.coerce.number().positive().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  transactionId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  status: z.string().optional(),
  byHand: z.string().optional().nullable(),
  creator: z.string().optional().nullable(),
  imgLink: z.string().optional().nullable(),
});

type DbManualReceipt = {
  id: string;
  slip_no: number;
  first_name: string;
  last_name: string;
  full_name: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  pancard: string | null;
  aadhar_card: string | null;
  dob: string | null;
  amount: number;
  payment_method: string;
  transaction_id: string | null;
  note: string | null;
  status: string;
  by_hand: string | null;
  creator: string | null;
  img_link: string | null;
  trust: string | null;
  donation_type: string | null;
  donation_in: string | null;
  payment_mode: string | null;
  created_at: string;
};

function mapRow(row: DbManualReceipt): ManualReceipt {
  return {
    id: row.id,
    slipNo: row.slip_no,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    pancard: row.pancard,
    aadharCard: row.aadhar_card,
    dob: row.dob,
    amount: Number(row.amount),
    paymentMethod: row.payment_method,
    transactionId: row.transaction_id,
    note: row.note,
    status: row.status,
    byHand: row.by_hand,
    creator: row.creator,
    imgLink: row.img_link,
    trust: row.trust,
    donationType: row.donation_type,
    donationIn: row.donation_in,
    paymentMode: row.payment_mode,
    createdAt: row.created_at,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireFeature(request, "donationsManage");
    const body = await request.json();
    const payload = UpdateSchema.parse(body);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ message: "Missing receipt id" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (payload.firstName !== undefined) updates.first_name = payload.firstName;
    if (payload.lastName !== undefined) updates.last_name = payload.lastName;
    if (payload.fullName !== undefined) updates.full_name = payload.fullName || null;
    if (payload.phone !== undefined) updates.phone = payload.phone;
    if (payload.email !== undefined) updates.email = payload.email || null;
    if (payload.address !== undefined) updates.address = payload.address || null;
    if (payload.city !== undefined) updates.city = payload.city || null;
    if (payload.pancard !== undefined) updates.pancard = payload.pancard || null;
    if (payload.aadharCard !== undefined) updates.aadhar_card = payload.aadharCard || null;
    if (payload.dob !== undefined) updates.dob = payload.dob || null;
    if (payload.amount !== undefined) updates.amount = payload.amount;
    if (payload.paymentMethod !== undefined) updates.payment_method = payload.paymentMethod;
    if (payload.transactionId !== undefined) updates.transaction_id = payload.transactionId || null;
    if (payload.note !== undefined) updates.note = payload.note || null;
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.byHand !== undefined) updates.by_hand = payload.byHand || null;
    if (payload.creator !== undefined) updates.creator = payload.creator || null;
    if (payload.imgLink !== undefined) updates.img_link = payload.imgLink || null;
    if (payload.trust !== undefined) updates.trust = payload.trust || null;
    if (payload.donationType !== undefined) updates.donation_type = payload.donationType || null;
    if (payload.donationIn !== undefined) updates.donation_in = payload.donationIn || null;
    if (payload.paymentMode !== undefined) updates.payment_mode = payload.paymentMode || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "Nothing to update" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("manual_receipts")
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Failed to update manual receipt", error);
      return NextResponse.json(
        { message: "Unable to update receipt." },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json({ message: "Receipt not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: mapRow(data as unknown as DbManualReceipt),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid payload", issues: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    console.error("Unexpected manual receipt update error", error);
    return NextResponse.json(
      { message: "Unexpected error while updating receipt." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireFeature(request, "donationsManage");
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ message: "Missing receipt id" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { error } = await supabase
      .from("manual_receipts")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Failed to delete manual receipt", error);
      return NextResponse.json(
        { message: "Unable to delete receipt." },
        { status: 500 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("Unexpected manual receipt delete error", error);
    return NextResponse.json(
      { message: "Unexpected error while deleting receipt." },
      { status: 500 },
    );
  }
}
