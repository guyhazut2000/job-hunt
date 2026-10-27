import type { MailProvider } from "./types";

/**
 * Placeholder for Microsoft Graph (scope: Mail.Read, offline_access).
 * Implementation sketch: OAuth via login.microsoftonline.com/common/oauth2/v2.0,
 * GET /me/messages?$search="..."&$select=id,from,subject,receivedDateTime,bodyPreview.
 */
const notImplemented = async (): Promise<never> => {
  throw new Error("Outlook sync is not implemented yet");
};

export const outlookProvider: MailProvider = {
  id: "OUTLOOK",
  configured: () => false,
  refreshAccessToken: notImplemented,
  search: notImplemented,
  messageUrl: (id) => `https://outlook.office.com/mail/deeplink/read/${encodeURIComponent(id)}`,
};
