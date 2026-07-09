"use client";

import * as React from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authorizedFetch } from "@/lib/auth/client-session";

// Minimal typings for the Facebook JS SDK surface we use (avoids `any`).
interface FbLoginResponse {
  authResponse?: { code?: string } | null;
  status?: string;
}
interface FbSdk {
  init(params: { appId: string; version: string; xfbml?: boolean }): void;
  login(
    callback: (response: FbLoginResponse) => void,
    options: Record<string, unknown>,
  ): void;
}
declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

const SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const API_VERSION = "v22.0";

/** Embedded-Signup "FINISH" payload carries the linked phone number + WABA ids. */
interface EmbeddedSignupData {
  phone_number_id?: string;
  waba_id?: string;
}

export default function WhatsAppOnboardingPage() {
  const [ready, setReady] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const sessionRef = React.useRef<EmbeddedSignupData>({});

  const appId = process.env.NEXT_PUBLIC_WHATSAPP_APP_ID;
  const configId = process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID;

  // Load the FB SDK once and capture the embedded-signup message events.
  React.useEffect(() => {
    if (!appId) {
      return;
    }

    window.fbAsyncInit = () => {
      window.FB?.init({ appId, version: API_VERSION, xfbml: false });
      setReady(true);
    };

    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = SDK_SRC;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    } else if (window.FB) {
      setReady(true);
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
        return;
      }
      try {
        const parsed = JSON.parse(String(event.data)) as {
          type?: string;
          event?: string;
          data?: EmbeddedSignupData;
        };
        if (parsed.type === "WA_EMBEDDED_SIGNUP" && parsed.data) {
          sessionRef.current = { ...sessionRef.current, ...parsed.data };
        }
      } catch {
        // Non-JSON messages are not from embedded signup; ignore.
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [appId]);

  const finalize = React.useCallback(async (code: string) => {
    const { phone_number_id: phoneNumberId, waba_id: wabaId } = sessionRef.current;
    if (!phoneNumberId) {
      toast.error("Did not receive a phone number id from WhatsApp. Please retry.");
      return;
    }
    setBusy(true);
    try {
      const response = await authorizedFetch("/api/whatsapp/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phoneNumberId, wabaId }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        toast.error(data?.message || "Onboarding failed.");
        return;
      }
      toast.success("WhatsApp connected! The number is now live on the API.");
    } catch (error) {
      console.error("WhatsApp onboarding error", error);
      toast.error("Onboarding failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const connect = React.useCallback(() => {
    if (!window.FB || !configId) {
      toast.error("WhatsApp onboarding is not configured.");
      return;
    }
    sessionRef.current = {};
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (code) {
          void finalize(code);
        } else {
          toast.error("WhatsApp connection was cancelled.");
        }
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {
            featureType: "whatsapp_business_app_onboard",
            sessionInfoVersion: 2,
          },
        },
      },
    );
  }, [configId, finalize]);

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Connect WhatsApp</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Link your WhatsApp Business app number to the Cloud API using Coexistence. Your existing
        chats stay intact, and you can keep using the WhatsApp Business app while automations run on
        the same number. Do not use the standard “Add phone number” flow — it would disconnect the
        app and erase history.
      </p>

      {!appId || !configId ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Set <code>NEXT_PUBLIC_WHATSAPP_APP_ID</code> and <code>NEXT_PUBLIC_WHATSAPP_CONFIG_ID</code>{" "}
          to enable onboarding.
        </p>
      ) : (
        <Button onClick={connect} disabled={!ready || busy}>
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting…
            </>
          ) : (
            <>
              <MessageCircle className="mr-2 h-4 w-4" />
              Connect WhatsApp
            </>
          )}
        </Button>
      )}
    </div>
  );
}
