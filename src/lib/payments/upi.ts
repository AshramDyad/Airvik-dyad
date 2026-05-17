export type UpiPaymentInput = {
  upiId: string;
  merchantName?: string;
  amount: number;
  reference: string;
  currency?: string;
  note?: string;
};

type ReservationPaymentRequestPublic = {
  amount: number;
  paidAmount: number;
  token: string;
};

const getRemainingAmount = (request: ReservationPaymentRequestPublic) => {
  const remaining = request.amount - request.paidAmount;
  return remaining > 0 ? Number(remaining.toFixed(2)) : 0;
};

const buildCommonUpiParams = (
  request: ReservationPaymentRequestPublic,
  property: { upiId: string; upiMerchantName?: string | null },
  currency = "INR"
) => {
  const upiId = property.upiId?.trim();
  if (!upiId) {
    return null;
  }

  const remainingAmount = getRemainingAmount(request);
  const merchantName = property.upiMerchantName?.trim();
  const params = new URLSearchParams();
  params.set("pa", upiId);
  params.set("pn", merchantName || "Hotel");
  params.set("am", remainingAmount.toFixed(2));
  params.set("cu", currency);
  params.set("tr", request.token);
  params.set("tn", `Reservation payment: ${request.token}`);

  return params;
};

export const calculateRemainingPaymentAmount = (
  request: Pick<ReservationPaymentRequestPublic, "amount" | "paidAmount"> | undefined | null
) => {
  if (!request) {
    return 0;
  }

  const outstanding = request.amount - request.paidAmount;
  return outstanding > 0 ? Number(outstanding.toFixed(2)) : 0;
};

export const buildReservationPaymentUpiLink = (
  request: ReservationPaymentRequestPublic,
  property: { upiId: string; upiMerchantName?: string | null },
  currency = "INR"
) => {
  const params = buildCommonUpiParams(request, property, currency);
  if (!params) {
    return null;
  }

  return `upi://pay?${params.toString()}`;
};

export const buildReservationPaymentIntentLink = (
  request: ReservationPaymentRequestPublic,
  property: { upiId: string; upiMerchantName?: string | null },
  fallbackUrl: string,
  currency = "INR"
) => {
  const params = buildCommonUpiParams(request, property, currency);
  if (!params) {
    return null;
  }

  const safeFallback = encodeURIComponent(fallbackUrl);
  const intent = new URLSearchParams({
    ...Object.fromEntries(params.entries()),
  }).toString();
  return [
    `intent://pay?${intent}`,
    "#Intent;",
    "scheme=upi;",
    "action=android.intent.action.VIEW;",
    "category=android.intent.category.BROWSABLE;",
    `S.browser_fallback_url=${safeFallback};`,
    "end",
  ].join("");
};

export const buildReservationPaymentLaunchLinks = (
  request: ReservationPaymentRequestPublic,
  property: { upiId: string; upiMerchantName?: string | null },
  fallbackUrl: string,
  currency = "INR"
) => {
  const upiLink = buildReservationPaymentUpiLink(request, property, currency);
  const intentLink = buildReservationPaymentIntentLink(
    request,
    property,
    fallbackUrl,
    currency
  );

  return { upiLink, intentLink };
};

export const buildReservationPaymentQrUrl = (
  upiLink: string,
  size = 220
) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(upiLink)}`;
