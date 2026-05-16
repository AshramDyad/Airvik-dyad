type WhatsAppResult = { success: true } | { success: false; error: string };

function getWhatsAppConfig() {
  const apiUrl = process.env.GOWA_API_URL;
  const apiUser = process.env.GOWA_API_USER;
  const apiPassword = process.env.GOWA_API_PASSWORD;
  const deviceId = process.env.GOWA_DEVICE_ID;

  if (!apiUrl || !apiUser || !apiPassword || !deviceId) {
    throw new Error(
      "Missing WhatsApp (GOWA) credentials. Set GOWA_API_URL, GOWA_API_USER, GOWA_API_PASSWORD, and GOWA_DEVICE_ID.",
    );
  }

  return { apiUrl, apiUser, apiPassword, deviceId } as const;
}

function getHeaders(config: ReturnType<typeof getWhatsAppConfig>) {
  const authHeader = Buffer.from(`${config.apiUser}:${config.apiPassword}`).toString("base64");
  return {
    Authorization: `Basic ${authHeader}`,
    "X-Device-Id": config.deviceId,
  };
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<WhatsAppResult> {
  try {
    const config = getWhatsAppConfig();
    const response = await fetch(`${config.apiUrl}/send/message`, {
      method: "POST",
      cache: "no-store",
      headers: {
        ...getHeaders(config),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone, message }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[WhatsApp] sendMessage failed (${response.status}): ${text}`);
      return { success: false, error: `GOWA API error: ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    const message_ = err instanceof Error ? err.message : "Unknown error";
    console.error(`[WhatsApp] sendMessage exception: ${message_}`);
    return { success: false, error: message_ };
  }
}

export async function sendWhatsAppImage(
  phone: string,
  image: File | Blob,
  caption?: string,
): Promise<WhatsAppResult> {
  try {
    const config = getWhatsAppConfig();
    const formData = new FormData();
    formData.append("phone", phone);
    formData.append("image", image);
    if (caption) formData.append("caption", caption);

    const response = await fetch(`${config.apiUrl}/send/image`, {
      method: "POST",
      cache: "no-store",
      headers: getHeaders(config),
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[WhatsApp] sendImage failed (${response.status}): ${text}`);
      return { success: false, error: `GOWA API error: ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[WhatsApp] sendImage exception: ${message}`);
    return { success: false, error: message };
  }
}

export async function sendWhatsAppFile(
  phone: string,
  file: File | Blob,
  caption?: string,
): Promise<WhatsAppResult> {
  try {
    const config = getWhatsAppConfig();
    const formData = new FormData();
    formData.append("phone", phone);
    formData.append("file", file);
    if (caption) formData.append("caption", caption);

    const response = await fetch(`${config.apiUrl}/send/file`, {
      method: "POST",
      cache: "no-store",
      headers: getHeaders(config),
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[WhatsApp] sendFile failed (${response.status}): ${text}`);
      return { success: false, error: `GOWA API error: ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[WhatsApp] sendFile exception: ${message}`);
    return { success: false, error: message };
  }
}
