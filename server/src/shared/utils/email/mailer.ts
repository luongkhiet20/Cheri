import sgMail from '@sendgrid/mail';

import { getContent } from './email-utils';

const getSendGridClient = () => {
  const apiKey = process.env.SENDGRID_KEY?.trim();

  if (!apiKey) {
    throw new Error('SendGrid is not configured: SENDGRID_KEY is missing');
  }

  if (!apiKey.startsWith('SG.')) {
    throw new Error('SendGrid API key must start with "SG."');
  }

  sgMail.setApiKey(apiKey);
  return sgMail;
};

export const sendMsg = async (email: string, emailType, translations) => {
  const msg = {
    to: email,
    from: process.env.EMAIL_FROM,
    subject: emailType.subject,
    html: getContent(emailType, translations),
  };
  const mailer = getSendGridClient();

  try {
    return await mailer.send(msg);
  } catch (error) {
    console.error(error);

    if (error.response) {
      console.error(error.response.body);
    }
  }
};

export const sendPasswordResetOtp = async (
  email: string,
  otp: string,
): Promise<void> => {
  const from = process.env.EMAIL_FROM;

  if (!from) {
    throw new Error(
      'SendGrid is not configured: EMAIL_FROM is missing',
    );
  }

  const mailer = getSendGridClient();
  const msg = {
    to: email,
    from,
    subject: 'Mã OTP đặt lại mật khẩu CHERI',
    text: `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong 5 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Đặt lại mật khẩu CHERI</h2>
        <p>Mã xác minh OTP của bạn là:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">
          ${otp}
        </p>
        <p>Mã có hiệu lực trong <strong>5 phút</strong>.</p>
        <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
      </div>
    `,
  };

  await mailer.send(msg);
};
