"use client";

import * as React from "react";
import {
  Link2,
  Mail,
  MessageCircle,
  Facebook,
  Twitter,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { RoomType } from "@/data/types";
import { getRoomTypeImageUrl } from "@/lib/room-type-images";
import Image from "next/image";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomType: RoomType;
  shareUrl: string;
}

interface ShareOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export function ShareDialog({
  open,
  onOpenChange,
  roomType,
  shareUrl,
}: ShareDialogProps) {
  const [copied, setCopied] = React.useState(false);

  const shareText = `Check out this room: ${roomType.name} at Airvik Dyad Ashram`;

  const roomPhotoUrl = React.useMemo(
    () => getRoomTypeImageUrl(roomType),
    [roomType]
  );

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Check out ${roomType.name}`);
    const body = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`${shareText}\n${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const handleFacebookShare = () => {
    const url = encodeURIComponent(shareUrl);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleTwitterShare = () => {
    const url = encodeURIComponent(shareUrl);
    const text = encodeURIComponent(shareText);
    window.open(
      `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleMessagesShare = () => {
    const text = encodeURIComponent(`${shareText}\n${shareUrl}`);
    if (navigator.share) {
      navigator
        .share({
          title: roomType.name,
          text: shareText,
          url: shareUrl,
        })
        .catch(() => {
          toast.error("Sharing not supported");
        });
    } else {
      window.open(`sms:?body=${text}`, "_self");
    }
  };

  const shareOptions: ShareOption[] = [
    {
      id: "copy",
      label: copied ? "Copied!" : "Copy Link",
      icon: copied ? (
        <Check className="h-7 w-7" />
      ) : (
        <Link2 className="h-7 w-7" />
      ),
      onClick: handleCopyLink,
    },
    {
      id: "email",
      label: "Email",
      icon: <Mail className="h-7 w-7" />,
      onClick: handleEmailShare,
    },
    {
      id: "messages",
      label: "Messages",
      icon: <MessageCircle className="h-7 w-7" />,
      onClick: handleMessagesShare,
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: (
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      ),
      onClick: handleWhatsAppShare,
    },
    {
      id: "facebook",
      label: "Facebook",
      icon: <Facebook className="h-7 w-7" />,
      onClick: handleFacebookShare,
    },
    {
      id: "twitter",
      label: "Twitter",
      icon: <Twitter className="h-7 w-7" />,
      onClick: handleTwitterShare,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-xl p-6">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <Image
                src={roomPhotoUrl}
                alt={roomType.name}
                width={100}
                height={100}
                className="w-20 h-20 rounded-xl object-cover"
              />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl text-gray-900 font-semibold">
                Share this place
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600 pt-2">
                {roomType.name} • Rishikesh, Uttarakhand
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 pt-4">
          {/* share options */}
          {shareOptions.map((option) => (
            <Button
              key={option.id}
              variant="ghost"
              className="flex py-7 px-4 gap-3 justify-start rounded-xl transition-all border border-gray-300 hover:bg-gray-50"
              onClick={option.onClick}
            >
              <div className="rounded-full flex items-center justify-center text-gray-700 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                {option.icon}
              </div>
              <span className="font-semibold text-lg text-gray-900">
                {option.label}
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
