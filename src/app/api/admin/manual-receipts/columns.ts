export const MANUAL_RECEIPT_SELECT_COLUMNS =
  "id, slip_no, first_name, last_name, full_name, phone, email, address, city, pancard, aadhar_card, dob, amount, payment_method, transaction_id, note, status, by_hand, creator, img_link, trust, donation_type, donation_in, payment_mode, created_at" as const;
export const MANUAL_RECEIPT_CREATE_RETURN_COLUMNS =
  "id, slip_no, created_at" as const;
export const MANUAL_RECEIPT_PATCH_RETURN_COLUMNS = "id" as const;
