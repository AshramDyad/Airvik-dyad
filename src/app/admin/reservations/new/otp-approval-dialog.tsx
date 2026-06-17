"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { authorizedFetch } from "@/lib/auth/client-session";

export interface DiscountApprovalContext {
  guestName: string;
  customAmount: number;
  originalAmount: number;
}

interface DiscountApprovalDialogProps {
  open: boolean;
  context: DiscountApprovalContext | null;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}

const OTP_LENGTH = 6;

type RequestResponse = { otpId?: string; message?: string };
type VerifyResponse = { verified?: boolean; message?: string };

export function DiscountApprovalDialog({
  open,
  context,
  onOpenChange,
  onVerified,
}: DiscountApprovalDialogProps) {
  const [code, setCode] = React.useState("");
  const [otpId, setOtpId] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const requestedRef = React.useRef(false);

  const requestOtp = React.useCallback(
    async (ctx: DiscountApprovalContext) => {
      setSending(true);
      setCode("");
      setOtpId(null);
      try {
        const response = await authorizedFetch("/api/admin/reservations/otp/request", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guestName: ctx.guestName,
            customAmount: ctx.customAmount,
            originalAmount: ctx.originalAmount,
          }),
        });
        const body = (await response.json().catch(() => null)) as RequestResponse | null;
        if (!response.ok || !body?.otpId) {
          throw new Error(body?.message ?? "Could not send the OTP.");
        }
        setOtpId(body.otpId);
        toast.success("OTP sent to the approval number on WhatsApp.");
      } catch (error) {
        toast.error("Failed to send OTP", {
          description: error instanceof Error ? error.message : undefined,
        });
        onOpenChange(false);
      } finally {
        setSending(false);
      }
    },
    [onOpenChange]
  );

  // Request one OTP when the dialog opens; reset the guard when it closes.
  React.useEffect(() => {
    if (open && context && !requestedRef.current) {
      requestedRef.current = true;
      void requestOtp(context);
    }
    if (!open) {
      requestedRef.current = false;
    }
  }, [open, context, requestOtp]);

  const verify = async () => {
    if (!otpId || code.length !== OTP_LENGTH) return;
    setVerifying(true);
    try {
      const response = await authorizedFetch("/api/admin/reservations/otp/verify", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpId, code }),
      });
      const body = (await response.json().catch(() => null)) as VerifyResponse | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "Verification failed.");
      }
      if (body?.verified) {
        onVerified();
      } else {
        toast.error("Incorrect or expired OTP. Please try again.");
        setCode("");
      }
    } catch (error) {
      toast.error("Verification failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setVerifying(false);
    }
  };

  const busy = sending || verifying;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Owner approval required</DialogTitle>
          <DialogDescription>
            {context
              ? `This booking is discounted (₹${formatAmount(context.originalAmount)} → ₹${formatAmount(
                  context.customAmount
                )}). `
              : ""}
            Enter the 6-digit OTP sent to the approval number on WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-2">
          <InputOTP maxLength={OTP_LENGTH} value={code} onChange={setCode} disabled={busy}>
            <InputOTPGroup>
              {Array.from({ length: OTP_LENGTH }, (_, index) => (
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="w-full"
            onClick={verify}
            disabled={code.length !== OTP_LENGTH || busy}
          >
            {verifying ? "Verifying…" : "Verify & create reservation"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => context && void requestOtp(context)}
            disabled={busy}
          >
            {sending ? "Sending…" : "Resend OTP"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatAmount(value: number): string {
  return Math.round(value).toLocaleString("en-IN");
}
