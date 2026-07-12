import crypto from "crypto";
import Razorpay from "razorpay";

let client: Razorpay | null = null;

export function isRazorpayMockMode(): boolean {
  const enabled = String(process.env.RAZORPAY_MOCK_MODE).toLowerCase() === "true";
  // Mock mode makes every signature check pass and marks payments "paid" without
  // money moving. It must never be active in production. Fail hard the first time
  // it is consulted rather than silently accepting forged payments. See finding M3.
  if (enabled && process.env.NODE_ENV === "production") {
    throw new Error(
      "RAZORPAY_MOCK_MODE must not be enabled in production.",
    );
  }
  return enabled;
}

// Constant-time comparison of two hex signature strings to avoid a timing
// side-channel (finding L1). Length mismatch short-circuits to false.
function signaturesMatch(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function getKeyConfig() {
  if (isRazorpayMockMode()) {
    return {
      keyId:
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
        process.env.RAZORPAY_KEY_ID ||
        "rzp_test_mock",
      keySecret: process.env.RAZORPAY_KEY_SECRET || "mock_secret",
    } as const;
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Missing Razorpay credentials. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }

  return { keyId, keySecret } as const;
}

export function getRazorpayClient(): Razorpay {
  if (client) {
    return client;
  }

  if (isRazorpayMockMode()) {
    throw new Error("Razorpay client is unavailable while mock mode is enabled.");
  }

  const { keyId, keySecret } = getKeyConfig();
  client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
}

export function verifyCheckoutSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (isRazorpayMockMode()) {
    return true;
  }
  const { keySecret } = getKeyConfig();
  const payload = `${params.orderId}|${params.paymentId}`;
  const expectedSignature = crypto.createHmac("sha256", keySecret).update(payload).digest("hex");
  return signaturesMatch(expectedSignature, params.signature);
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (isRazorpayMockMode()) {
    return true;
  }
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing RAZORPAY_WEBHOOK_SECRET environment variable.");
  }

  const computed = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return signaturesMatch(computed, signature);
}
