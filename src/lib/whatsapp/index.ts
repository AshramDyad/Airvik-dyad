// Public surface of the WhatsApp integration. Keeping `@/lib/whatsapp` exporting
// the same send* functions means existing callers (admin send-invoice /
// send-payment-qr routes and the reservation discount-approval OTP) keep working
// after the GOWA → official Meta Cloud API switch.
//
// Send-only surface: this branch ships the OTP approval gate with NO inbound
// automation (no webhook bot, no auto-confirmations). The webhook/onboarding/bot
// modules live on `feat/whatsapp-cloud-api` and are intentionally not included here.
export * from "./types";
export * from "./cloud-api";
export { getApiVersion, getNumberConfig } from "./config";
