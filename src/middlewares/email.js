import { transporter } from "./email.config.js";
import {Verification_Email_Template, Welcome_Email_Template} from "./emailTemplate.js";


export const sendVerificationCode = async (email, verificationCode) => {

    try {
        
        const response = await transporter.sendMail({
            from: '"ChatAppCompany" <shahzaibshahg90@gmail.com>',
            to: email,
            subject: "verify your email",
            text: "verify your email",
            html: Verification_Email_Template.replace("{verificationCode}", verificationCode),
        });
        console.log("Email send successfully", response);

    } catch (error) {
        console.log("Email error", error);
    }
};


export const WelcomeEmail = async (email, name) => {
  try {
    const response = await transporter.sendMail({
      from: '"ChatAppCompany" <shahzaibshahg90@gmail.com>',
      to: email,
      subject: "Welcome Email",
      text: "Welcome Email", // plain‑text body
      html: Welcome_Email_Template.replace("{name}", name), // HTML body
    });
    console.log("Email send successfully", response);
  } catch (error) {
    console.log("Email error", error);
  }
};