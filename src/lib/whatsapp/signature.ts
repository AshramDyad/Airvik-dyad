import crypto from "crypto";

import { getAppSecret } from "./config";

/**
 * Verify a Meta webhook POST against the `X-Hub-Signature-256` header.
 *
 * Meta signs the *raw* request body with HMAC-SHA256 keyed by the app secret and
 * sends it as `sha256=<hex>`. We must compute over the exact bytes we received
 * (read via `request.text()` before any JSON parse) and compare in constant time.
 */
export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) {
    return false;
  }
  const expected =
    "sha256=" + crypto.createHmac("sha256", getAppSecret()).update(rawBody, "utf8").digest("hex");

  const received = Buffer.from(signatureHeader);
  const computed = Buffer.from(expected);
  if (received.length !== computed.length) {
    return false;
  }
  return crypto.timingSafeEqual(received, computed);
}
