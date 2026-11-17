import sgMail from '@sendgrid/mail';

import { getContent } from './email-utils';

const isSendGridConfigured = (): boolean => {
  const apiKey = process.env.SENDGRID_KEY?.trim();
  return Boolean(
    apiKey &&
    apiKey.startsWith('SG.') &&
    !apiKey.includes('your-actual') &&
    !apiKey.includes('placeholder')
  );
};

const getSendGridClient = () => {
  const apiKey = process.env.SENDGRID_KEY?.trim();

  if (!isSendGridConfigured()) {
    return null;
  }

  sgMail.setApiKey(apiKey!);
  return sgMail;
};

export const sendMsg = async (email: string, emailType, translations) => {
  const from = process.env.EMAIL_FROM || 'lekieugiamyy@gmail.com';
  const msg = {
    to: email,
    from,
    subject: emailType.subject,
    html: getContent(emailType, translations),
  };
  const mailer = getSendGridClient();
  if (!mailer) {
    console.log(`[SendGrid] [DEV] Not configured, skipping sendMsg to ${email}`);
    return;
  }

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
  const fromEmail = (process.env.EMAIL_FROM || 'lekieugiamyy@gmail.com').trim();
  const mailer = getSendGridClient();

  if (!mailer) {
    throw new Error('SendGrid is not configured: SENDGRID_KEY is missing');
  }

  const msg = {
    to: email,
    from: {
      email: fromEmail,
      name: 'CHERI',
    },
    subject: 'Mã xác thực đặt lại mật khẩu - Chéri',
    text: `Mã OTP của bạn là ${otp}. Mã có hiệu lực trong 5 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px; color: #2B2B2B; max-width: 600px; margin: auto; border: 1px solid #E5E0E0; border-radius: 8px;">
        <h2 style="color: #74070E; margin-bottom: 16px;">Yêu cầu đặt lại mật khẩu</h2>
        <p>Xin chào,</p>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>${email}</strong>.</p>
        <p>Mã xác thực OTP của bạn là:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #74070E; background: #F5E8E9; padding: 16px; border-radius: 6px; text-align: center; margin: 20px 0;">
          ${otp}
        </div>
        <p>Mã xác thực có hiệu lực trong <strong>5 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai để bảo vệ tài khoản.</p>
        <hr style="border: none; border-top: 1px solid #EEEAEA; margin: 20px 0;" />
        <p style="font-size: 12px; color: #9A9A9A;">Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email này.</p>
      </div>
    `,
  };

  await mailer.send(msg);
  console.log(`[SendGrid] Đã gửi email mã OTP thành công tới ${email} từ ${fromEmail}`);
};
