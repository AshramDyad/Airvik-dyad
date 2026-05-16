import { describe, expect, it } from "vitest";

import type { ManualReceipt } from "@/data/types";

import {
  mergeManualReceiptUpdate,
  type ManualReceiptEditValues,
} from "./manual-receipt-utils";

const receipt: ManualReceipt = {
  id: "receipt-1",
  slipNo: 7,
  firstName: "Asha",
  lastName: "Guest",
  fullName: "Asha Guest",
  phone: "9999999999",
  email: "asha@example.com",
  address: "Tapovan",
  city: "Rishikesh",
  pancard: "ABCDE1234F",
  aadharCard: null,
  dob: "1990-01-01",
  amount: 1000,
  paymentMethod: "Cash",
  transactionId: null,
  note: "Original note",
  status: "Pending",
  byHand: null,
  creator: "Desk",
  imgLink: null,
  trust: "SWT",
  donationType: "General",
  donationIn: "Cash SWT",
  paymentMode: "Cash",
  createdAt: "2026-05-01T00:00:00.000Z",
};

describe("manual receipt update merge", () => {
  it("applies editable values locally while preserving untouched receipt fields", () => {
    const values: ManualReceiptEditValues = {
      firstName: "Asha",
      lastName: "Updated",
      phone: "8888888888",
      email: "",
      address: "",
      amount: 1500,
      paymentMethod: "UPI",
      transactionId: "txn-1",
      note: "",
      status: "Accepted",
      byHand: "Volunteer",
      creator: "",
      imgLink: "",
    };

    expect(mergeManualReceiptUpdate(receipt, values)).toEqual({
      ...receipt,
      firstName: "Asha",
      lastName: "Updated",
      phone: "8888888888",
      email: null,
      address: null,
      amount: 1500,
      paymentMethod: "UPI",
      transactionId: "txn-1",
      note: null,
      status: "Accepted",
      byHand: "Volunteer",
      creator: null,
      imgLink: null,
    });
  });
});
