import type { EmailProvider } from "@prisma/client";
import type { MailMessage } from "../parse";

export type SearchOptions = {
  accessToken: string;
  lookbackDays: number;
  statusUpdates: boolean;
  max: number;
};

/**
 * A mailbox provider. Implementations must only request read-only scopes and must never
 * persist message bodies; `fetchBodyText` is for transient extraction only.
 */
export interface MailProvider {
  id: EmailProvider;
  configured(): boolean;
  /** Exchange a stored refresh token for a short-lived access token. */
  refreshAccessToken(refreshToken: string): Promise<string>;
  /** Metadata + snippet for messages matching application patterns in the lookback window. */
  search(opts: SearchOptions): Promise<MailMessage[]>;
  /** Plain-text body, truncated (~4KB). Used in memory only, never stored. */
  fetchBodyText?(accessToken: string, messageId: string): Promise<string | null>;
  /** Revoke the grant on disconnect (best effort). */
  revoke?(refreshToken: string): Promise<void>;
  /** Deep link to the message in the provider's web UI. */
  messageUrl(messageId: string): string;
}

export class ProviderAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderAuthError";
  }
}
