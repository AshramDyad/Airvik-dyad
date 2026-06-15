/** Result shape shared by every WhatsApp send helper. */
export type WhatsAppResult =
  | { success: true; messageId?: string }
  | { success: false; error: string };

/** A single interactive reply button (WhatsApp allows at most 3, title ≤ 20 chars). */
export interface ReplyButton {
  id: string;
  title: string;
}

/**
 * What the bot decides to send back for one inbound message. `none` means stay
 * silent (e.g. a human is handling the thread, or the message isn't understood).
 */
export type BotReply =
  | { kind: "none" }
  | { kind: "text"; body: string }
  | { kind: "buttons"; body: string; buttons: ReplyButton[] };

/** A normalized inbound event extracted from a webhook payload. */
export interface InboundMessage {
  /** Sender phone in E.164 without "+" (e.g. "919876543210"). */
  from: string;
  /** Free-form text body, when the message is a text message. */
  text?: string;
  /** Button id the user tapped, when the message is an interactive reply. */
  buttonId?: string;
}
