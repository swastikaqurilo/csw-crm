require("dotenv").config();
const nodemailer = require("nodemailer");

(async () => {
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  console.log("Verifying connection...");
  try {
    await t.verify();
    console.log("✅ SMTP connection OK");

    console.log("Sending test mail...");
    const info = await t.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,   // send to yourself
      subject: "CSW SMTP test",
      text: "If you see this, SMTP works.",
    });
    console.log("✅ Sent:", info.messageId);
  } catch (err) {
    console.error("❌ FAILED:", err.message);
    console.error(err);
  }
})();