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

const CreateSchema = z.object({
  // New form fields
  fullName: z.string().min(1).optional(),
  city: z.string().optional(),
  pancard: z.string().optional(),
  aadharCard: z.string().optional(),
  dob: z.string().optional(),
  trust: z.string().optional(),
  donationType: z.string().optional(),
  donationIn: z.string().optional(),
  paymentMode: z.string().optional(),
  // Legacy fields (kept for edit dialog backward compat)
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().min(10),
  email: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.union([z.literal(""), z.string().email()]))
    .optional(),
  address: z.string().optional(),
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  transactionId: z.string().optional(),
  note: z.string().optional(),
  status: z.string().optional(),
  byHand: z.string().optional(),
  creator: z.string().optional(),
  imgLink: z.string().optional(),
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

export async function GET(request: Request) {
  try {
    await requireFeature(request, "donations");

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("manual_receipts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch manual receipts", error);
      return NextResponse.json(
        { message: "Unable to load receipts." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: (data ?? []).map((row) => mapRow(row as unknown as DbManualReceipt)),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    console.error("Unexpected manual receipts fetch error", error);
    return NextResponse.json(
      { message: "Unexpected error while loading receipts." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireFeature(request, "donationsCreate");

    const body = await request.json();
    const parsed = CreateSchema.parse(body);

    // Derive first_name / last_name from fullName for backward compat
    const fullName = parsed.fullName ?? "";
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = parsed.firstName ?? nameParts[0] ?? "";
    const lastName = parsed.lastName ?? nameParts.slice(1).join(" ") ?? "";

    // Use paymentMode as paymentMethod so existing table filters work
    const paymentMethod =
      parsed.paymentMethod ??
      ((parsed.paymentMode ?? "Cash") as (typeof PAYMENT_METHODS)[number]);

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("manual_receipts")
      .insert({
        first_name: firstName,
        last_name: lastName,
        full_name: fullName || null,
        phone: parsed.phone,
        email: parsed.email || null,
        address: parsed.address || null,
        city: parsed.city || null,
        pancard: parsed.pancard || null,
        aadhar_card: parsed.aadharCard || null,
        dob: parsed.dob || null,
        amount: parsed.amount,
        payment_method: paymentMethod,
        transaction_id: parsed.transactionId || null,
        note: parsed.note || null,
        status: parsed.status || "Accepted",
        by_hand: parsed.byHand || null,
        creator: parsed.creator || null,
        img_link: parsed.imgLink || null,
        trust: parsed.trust || null,
        donation_type: parsed.donationType || null,
        donation_in: parsed.donationIn || null,
        payment_mode: parsed.paymentMode || null,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Failed to insert manual receipt", error);
      return NextResponse.json(
        { message: "Unable to save receipt." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { data: mapRow(data as unknown as DbManualReceipt) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid data", issues: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    console.error("Unexpected manual receipt create error", error);
    return NextResponse.json(
      { message: "Unexpected error while saving receipt." },
      { status: 500 },
    );
  }
}
