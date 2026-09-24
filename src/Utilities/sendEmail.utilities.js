import nodemailer from "nodemailer";

const sendEmail = async (to, subject, text) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Use a 16-character Google App Password
      },
    });

    await transporter.sendMail({
      from: `"Udharo LMS" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });

    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error("Email send failed:", error);
    throw new Error("Could not send email");
  }
};

export default sendEmail;
