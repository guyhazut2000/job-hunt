import type { EmailProvider } from "@prisma/client";
import { gmailProvider } from "./gmail";
import { outlookProvider } from "./outlook";
import type { MailProvider } from "./types";

const PROVIDERS: Record<EmailProvider, MailProvider> = { GMAIL: gmailProvider, OUTLOOK: outlookProvider };

export function getProvider(id: EmailProvider): MailProvider {
  return PROVIDERS[id];
}

export function messageUrl(provider: EmailProvider, messageId: string): string {
  return PROVIDERS[provider].messageUrl(messageId);
}

export * from "./types";
