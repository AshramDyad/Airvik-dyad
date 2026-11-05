"use client";

import * as React from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authorizedFetch } from "@/lib/auth/client-session";
import type { Guest, Property, Reservation, Room, RoomType } from "@/data/types";

interface SendInvoiceWhatsAppButtonProps {
  reservations: Reservation[];
  guest: Guest | null | undefined;
  property: Property;
  rooms: Room[];
  roomTypes: RoomType[];
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export function SendInvoiceWhatsAppButton({
  reservations,
  guest,
  property,
  rooms,
  roomTypes,
  variant = "outline",
  size = "default",
}: SendInvoiceWhatsAppButtonProps) {
  const [isSending, setIsSending] = React.useState(false);

  const hasPhone = !!guest?.phone;

  const handleSend = async () => {
    if (!guest?.phone) {
      toast.error("Guest has no phone number.");
      return;
    }

    if (reservations.length === 0) {
      toast.error("No reservation data available.");
      return;
    }

    setIsSending(true);

    try {
      const { generateInvoice } = await import("@/lib/invoice/generate-invoice");
      const blob = await generateInvoice(
        { reservations, guest, property, rooms, roomTypes },
        { returnBlob: true },
      );

      if (!blob) {
        toast.error("Failed to generate receipt PDF.");
        return;
      }

      const formData = new FormData();
      formData.append("phone", guest.phone);
      formData.append("file", blob, "Donation-Receipt.pdf");

      const response = await authorizedFetch("/api/admin/send-invoice-whatsapp", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(data?.message || "Failed to send receipt on WhatsApp.");
        return;
      }

      toast.success("Receipt sent on WhatsApp!");
    } catch (error) {
      console.error("Failed to send invoice on WhatsApp:", error);
      toast.error("Failed to send receipt on WhatsApp. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => void handleSend()}
      disabled={isSending || !hasPhone || reservations.length === 0}
      title={!hasPhone ? "Guest has no phone number" : undefined}
    >
      {isSending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Sending...
        </>
      ) : (
        <>
          <Send className="mr-2 h-4 w-4" />
          Send receipt
        </>
      )}
    </Button>
  );
}
