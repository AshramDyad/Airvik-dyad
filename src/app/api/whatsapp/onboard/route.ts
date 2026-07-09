import { NextResponse } from "next/server";

import { HttpError, requireAdminProfile } from "@/lib/server/auth";
import { getApiVersion, getAppId, getAppSecret } from "@/lib/whatsapp/config";
import { saveWhatsAppConfig } from "@/lib/whatsapp/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OnboardPayload {
  code?: string;
  phoneNumberId?: string;
  wabaId?: string;
}

/**
 * Finalize Embedded Signup (coexistence): exchange the returned code for a
 * long-lived business token, subscribe our app to the WABA's webhooks, and store
 * the number config so the send layer can use it.
 */
export async function POST(request: Request) {
  try {
    await requireAdminProfile(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let payload: OnboardPayload;
  try {
    payload = (await request.json()) as OnboardPayload;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { code, phoneNumberId, wabaId } = payload;
  if (!code || !phoneNumberId) {
    return NextResponse.json(
      { message: "code and phoneNumberId are required" },
      { status: 400 },
    );
  }

  try {
    const apiVersion = getApiVersion();

    // 1. Exchange the signup code for a long-lived business-integration token.
    const tokenUrl = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", getAppId());
    tokenUrl.searchParams.set("client_secret", getAppSecret());
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl, { method: "GET" });
    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      console.error(`[whatsapp onboard] token exchange failed (${tokenResponse.status}): ${text}`);
      return NextResponse.json({ message: "Token exchange failed" }, { status: 502 });
    }
    const tokenJson = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      return NextResponse.json({ message: "No access token returned" }, { status: 502 });
    }
    const accessToken = tokenJson.access_token;

    // 2. Subscribe our app to this WABA's webhooks (so inbound events reach us).
    if (wabaId) {
      const subResponse = await fetch(
        `https://graph.facebook.com/${apiVersion}/${wabaId}/subscribed_apps`,
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!subResponse.ok) {
        const text = await subResponse.text();
        console.error(`[whatsapp onboard] webhook subscribe failed (${subResponse.status}): ${text}`);
      }
    }

    // 3. Persist for the send layer.
    await saveWhatsAppConfig({ phoneNumberId, accessToken, wabaId: wabaId ?? null });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[whatsapp onboard] error", error);
    return NextResponse.json({ message: "Onboarding failed" }, { status: 500 });
  }
}
