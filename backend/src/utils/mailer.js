const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const sendOtpEmail = async ({ to, otp, name }) => {
  // Space out digits for visual weight: "939786" → "9 3 9 7 8 6"
  const spacedOtp = String(otp).split("").join("&nbsp;&nbsp;");

  const year = new Date().getFullYear();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Reset your CSW password</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <!-- Preheader (invisible preview text in inbox) -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    Your CSW password reset code is ${otp}. Expires in 10 minutes.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.06),0 1px 3px rgba(15,23,42,0.04);">

          <!-- Top accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#0ea5e9 0%,#0891b2 50%,#0f2a52 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Header / brand -->
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="vertical-align:middle;padding-right:10px;">
                          <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#0f2a52,#002244);color:#ffffff;font-weight:700;font-size:14px;line-height:36px;text-align:center;letter-spacing:0.5px;">CSW</div>
                        </td>
                        <td style="vertical-align:middle;">
                          <div style="font-size:14px;font-weight:600;color:#0f172a;line-height:1.2;">Corvex Steel Wires</div>
                          <div style="font-size:11px;color:#94a3b8;line-height:1.3;margin-top:2px;">Commercial Workspace</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <div style="height:1px;background:#e2e8f0;line-height:0;font-size:0;">&nbsp;</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <h1 style="margin:0 0 8px 0;font-size:22px;line-height:1.3;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">
                Reset your password
              </h1>
              <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#64748b;">
                Hi ${name || "there"}, use the code below to set a new password for your CSW account.
              </p>

              <!-- OTP code -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
                <tr>
                  <td align="center" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px 16px;">
                    <div style="font-family:'SF Mono',Menlo,Monaco,Consolas,'Courier New',monospace;font-size:38px;font-weight:700;letter-spacing:0.15em;color:#0f172a;line-height:1.1;">
                      ${spacedOtp}
                    </div>
                    <div style="margin-top:8px;font-size:11px;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">
                      Your reset code
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiry hint -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;">
                    <div style="font-size:12px;color:#92400e;line-height:1.5;">
                      <strong style="font-weight:600;">Expires in 10 minutes.</strong>
                      If you need a new code, request one from the login page.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security note -->
          <tr>
            <td style="padding:0 32px 28px 32px;">
              <div style="font-size:12px;line-height:1.6;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:16px;">
                Didn't request this? You can safely ignore this email — your password hasn't been changed.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
              <div style="font-size:11px;color:#94a3b8;line-height:1.6;">
                © ${year} Corvex Steel Wires · Authorized access only
              </div>
              <div style="font-size:11px;color:#cbd5e1;line-height:1.6;margin-top:2px;">
                This is an automated message — please don't reply.
              </div>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();

  await transporter.sendMail({
    from: `"Corvex Steel Wires" <${process.env.SMTP_USER}>`,
    to,
    subject: `Your CSW password reset code: ${otp}`,
    text: `Your CSW password reset code is ${otp}. It expires in 10 minutes. If you didn't request this, ignore this email.`,
    html,
  });
};

module.exports = { sendOtpEmail };