/**
 * Email utilities for Orbit Portal.
 *
 * Uses Resend for transactional emails.
 * Fallback: logs to console if RESEND_API_KEY is not configured.
 */

interface InviteEmailParams {
  to: string;
  orgName: string;
  inviterName: string;
  inviteUrl: string;
  role: string;
}

export async function sendInviteEmail({
  to,
  orgName,
  inviterName,
  inviteUrl,
  role,
}: InviteEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Development fallback - log to console
    console.log("[Email] Would send invite email:", {
      to,
      orgName,
      inviterName,
      inviteUrl,
      role,
    });
    console.log(`[Email] Invite URL: ${inviteUrl}`);
    return;
  }

  const roleDisplay = role === "ADMIN" ? "an Admin" : "a Member";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0f; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #1a1a1f; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden;">
    <div style="padding: 32px; text-align: center;">
      <div style="width: 64px; height: 64px; background-color: rgba(43, 47, 255, 0.1); border-radius: 50%; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 28px;">🚀</span>
      </div>
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0 0 12px;">You're Invited!</h1>
      <p style="color: #9ca3af; font-size: 16px; line-height: 1.5; margin: 0 0 24px;">
        <strong style="color: #ffffff;">${inviterName}</strong> has invited you to join
        <strong style="color: #ffffff;">${orgName}</strong> as ${roleDisplay} on Orbit.
      </p>
      <a href="${inviteUrl}" style="display: inline-block; background-color: #2B2FFF; color: #ffffff; font-size: 16px; font-weight: 500; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
        Accept Invite
      </a>
      <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0;">
        This invite will expire in 7 days.
      </p>
    </div>
    <div style="background-color: rgba(255,255,255,0.02); padding: 16px 32px; border-top: 1px solid rgba(255,255,255,0.05);">
      <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
        If you didn't expect this invite, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "Orbit <noreply@orbit.example>",
      to,
      subject: `Join ${orgName} on Orbit`,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[Email] Failed to send:", error);
    throw new Error(`Failed to send email: ${error}`);
  }
}
