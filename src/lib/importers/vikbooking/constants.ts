import type {
  ReservationPaymentMethod,
  ReservationStatus,
} from "@/data/types";

export const VIKBOOKING_SOURCE = "vikbooking" as const;
export const IMPORT_CHUNK_SIZE = 250;

export const REQUIRED_COLUMNS = [
  "Booking ID",
  "Date",
  "Check-in",
  "Check-out",
  "Room",
  "People",
  "Customer Information",
  "Booking Status",
  "Total",
] as const;

const statusDefaults: Record<string, ReservationStatus> = {
  confirmed: "Confirmed",
  standby: "Standby",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  checkedin: "Checked-in",
  "checked-in": "Checked-in",
  checkedout: "Checked-out",
  "checked-out": "Checked-out",
  noshow: "No-show",
  "no show": "No-show",
  closure: "Cancelled",
  tentative: "Room Hold",
};

export const STATUS_MAP: Record<string, ReservationStatus> = statusDefaults;

const paymentDefaults: Record<string, ReservationPaymentMethod> = {
  cash: "Cash",
  "cash payment": "Cash",
  upi: "UPI",
  "pay with upi": "UPI",
  "upi transfer": "UPI",
  transfer: "Bank/IMPS",
  "bank transfer": "Bank/IMPS",
  "bank/imps": "Bank/IMPS",
  imps: "Bank/IMPS",
  "net banking": "Bank/IMPS",
  "bhagat ji": "Bhagat Ji",
  "anurag ji": "Anurag Ji",
  "card on file": "Not specified",
  "credit card": "Not specified",
  "debit card": "Not specified",
  online: "Not specified",
  razorpay: "Not specified",
  "pay later": "Not specified",
  "not specified": "Not specified",
  "not relevant": "Not specified",
};

export const PAYMENT_METHOD_MAP: Record<string, ReservationPaymentMethod> =
  paymentDefaults;

export const DEFAULT_PAYMENT_METHOD: ReservationPaymentMethod = "Not specified";
export const SUMMARY_PREVIEW_LIMIT = 25;
