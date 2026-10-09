// Send the finished report via Microsoft Graph, from your own mailbox, using
// app-only (client credentials) auth. Create an app registration in Entra ID
// with the Mail.Send application permission (admin-consented), and set:
//   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER (the mailbox UPN)
//
// Gmail/Workspace alternative: swap this module for a Gmail API or SMTP sender.

interface SendArgs {
  to: string;
  toName?: string;
  subject: string;
  bodyHtml: string;
  pdf: Buffer;
  pdfName: string;
}

async function graphToken(): Promise<string> {
  const { MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET } = process.env;
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET) {
    throw new Error("Microsoft Graph credentials are not configured.");
  }
  const res = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Graph token request failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function sendReportEmail(args: SendArgs): Promise<void> {
  const sender = process.env.MS_SENDER;
  if (!sender) throw new Error("MS_SENDER (sending mailbox) is not configured.");

  const token = await graphToken();

  const payload = {
    message: {
      subject: args.subject,
      body: { contentType: "HTML", content: args.bodyHtml },
      toRecipients: [{ emailAddress: { address: args.to, name: args.toName } }],
      attachments: [
        {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: args.pdfName,
          contentType: "application/pdf",
          contentBytes: args.pdf.toString("base64"),
        },
      ],
    },
    saveToSentItems: true,
  };

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Graph sendMail failed: ${res.status} ${detail}`);
  }
}
