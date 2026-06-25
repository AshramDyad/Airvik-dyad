/** Result shape shared by every WhatsApp send helper. */
export type WhatsAppResult =
  | { success: true; messageId?: string }
  | { success: false; error: string };

/** A single interactive reply button (WhatsApp allows at most 3, title ≤ 20 chars). */
export interface ReplyButton {
  id: string;
  title: string;
}
