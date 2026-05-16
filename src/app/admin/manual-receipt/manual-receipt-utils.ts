import type { ManualReceipt } from "@/data/types";

export type ManualReceiptEditValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address?: string;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  note?: string;
  status?: string;
  byHand?: string;
  creator?: string;
  imgLink?: string;
};

const blankToNull = (value: string | undefined): string | null =>
  value ? value : null;

export const mergeManualReceiptUpdate = (
  receipt: ManualReceipt,
  values: ManualReceiptEditValues,
): ManualReceipt => ({
  ...receipt,
  firstName: values.firstName,
  lastName: values.lastName,
  phone: values.phone,
  email: blankToNull(values.email),
  address: blankToNull(values.address),
  amount: Number(values.amount),
  paymentMethod: values.paymentMethod,
  transactionId: blankToNull(values.transactionId),
  note: blankToNull(values.note),
  status: values.status || receipt.status,
  byHand: blankToNull(values.byHand),
  creator: blankToNull(values.creator),
  imgLink: blankToNull(values.imgLink),
});
