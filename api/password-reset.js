const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { connectToMongo } = require('../server/admin-server');

const allowedEndpoints = new Set([
  'forgot-password',
  'verify-reset-otp',
  'reset-password',
]);

module.exports = async (req, res) => {
  const endpoint = req.query?.endpoint;

  if (!allowedEndpoints.has(endpoint)) {
    return res.status(404).json({ message: 'Password reset endpoint not found' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // 1. Nếu có backend NestJS riêng và URL hợp lệ, forward request sang đó
  const configuredBackendUrl = process.env.NEST_API_URL?.trim();
  if (configuredBackendUrl && configuredBackendUrl !== 'internal' && configuredBackendUrl !== 'self') {
    let backendUrl;
    try {
      backendUrl = new URL(configuredBackendUrl);
      if (['http:', 'https:'].includes(backendUrl.protocol)) {
        const upstream = await fetch(
          new URL(`/api/auth/${endpoint}`, backendUrl),
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(req.body ?? {}),
          },
        );
        const responseBody = await upstream.text();
        const contentType = upstream.headers.get('content-type');

        if (contentType) {
          res.setHeader('content-type', contentType);
        }

        return res.status(upstream.status).send(responseBody);
      }
    } catch (error) {
      console.warn('Forwarding to upstream NestJS failed, falling back to native handler:', error?.message);
    }
  }

  // 2. Native Serverless Handler: Xử lý trực tiếp qua MongoDB Atlas & SendGrid trên Vercel
  try {
    const db = await connectToMongo();
    const secret =
      process.env.PASSWORD_RESET_SECRET ||
      process.env.JWT_SECRET ||
      'cheri_password_reset_jwt_fallback_secret_key';

    if (endpoint === 'forgot-password') {
      const email = req.body?.email;
      const cleanEmail = String(email || '').trim().toLowerCase();
      const genericMessage = 'Nếu email tồn tại trong hệ thống, mã xác nhận gồm 6 chữ số đã được gửi.';

      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(200).json({ message: genericMessage });
      }

      const existingRecord = await db.collection('passwordresets').findOne({ email: cleanEmail });
      if (
        existingRecord &&
        existingRecord.updatedAt &&
        Date.now() - new Date(existingRecord.updatedAt).getTime() < 60_000
      ) {
        return res.status(200).json({ message: genericMessage });
      }

      const user = await db.collection('users').findOne({ email: cleanEmail });
      if (!user) {
        return res.status(200).json({ message: genericMessage });
      }

      const otp = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
      const otpHash = crypto.createHmac('sha256', secret).update(`${cleanEmail}:${otp}`).digest('hex');

      await db.collection('passwordresets').updateOne(
        { email: cleanEmail },
        {
          $set: {
            email: cleanEmail,
            otpHash,
            expiresAt: new Date(Date.now() + 5 * 60_000),
            attempts: 0,
            verified: false,
            resetTokenHash: null,
            resetTokenExpiresAt: null,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );

      // Gửi email qua SendGrid nếu SENDGRID_KEY hợp lệ
      const sendgridKey = process.env.SENDGRID_KEY?.trim();
      if (sendgridKey && sendgridKey.startsWith('SG.')) {
        try {
          const sgMail = require('@sendgrid/mail');
          sgMail.setApiKey(sendgridKey);
          await sgMail.send({
            to: cleanEmail,
            from: process.env.EMAIL_FROM || 'no-reply@cheri.vn',
            subject: 'Mã xác thực đặt lại mật khẩu - Chéri',
            html: `
              <div style="font-family: Arial, sans-serif; padding: 24px; color: #2B2B2B; max-width: 600px; margin: auto; border: 1px solid #E5E0E0; border-radius: 8px;">
                <h2 style="color: #74070E; margin-bottom: 16px;">Yêu cầu đặt lại mật khẩu</h2>
                <p>Xin chào,</p>
                <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>${cleanEmail}</strong>.</p>
                <p>Mã xác thực OTP của bạn là:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #74070E; background: #F5E8E9; padding: 16px; border-radius: 6px; text-align: center; margin: 20px 0;">
                  ${otp}
                </div>
                <p>Mã xác thực có hiệu lực trong <strong>5 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai để bảo vệ tài khoản.</p>
                <hr style="border: none; border-top: 1px solid #EEEAEA; margin: 20px 0;" />
                <p style="font-size: 12px; color: #9A9A9A;">Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email này.</p>
              </div>
            `,
          });
        } catch (mailError) {
          console.error(
            'Password reset SendGrid delivery error:',
            mailError?.response?.body || mailError.message,
          );
        }
      }

      return res.status(200).json({ message: genericMessage });
    }

    if (endpoint === 'verify-reset-otp') {
      const { email, otp } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanOtp = String(otp || '').trim();

      if (!cleanEmail || !cleanOtp) {
        return res.status(400).json({ message: 'Email và mã xác nhận là bắt buộc' });
      }

      const record = await db.collection('passwordresets').findOne({ email: cleanEmail });
      if (!record || !record.expiresAt || new Date() > new Date(record.expiresAt)) {
        return res.status(400).json({ message: 'Mã xác nhận không hợp lệ hoặc đã hết hạn.' });
      }

      if ((record.attempts || 0) >= 5) {
        return res.status(429).json({ message: 'Bạn đã nhập sai mã xác nhận quá số lần cho phép. Vui lòng yêu cầu mã mới.' });
      }

      const expectedOtpHash = crypto.createHmac('sha256', secret).update(`${cleanEmail}:${cleanOtp}`).digest('hex');
      if (expectedOtpHash !== record.otpHash) {
        await db.collection('passwordresets').updateOne({ email: cleanEmail }, { $inc: { attempts: 1 } });
        return res.status(400).json({ message: 'Mã xác nhận không chính xác.' });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHmac('sha256', secret).update(resetToken).digest('hex');

      await db.collection('passwordresets').updateOne(
        { email: cleanEmail },
        {
          $set: {
            verified: true,
            resetTokenHash,
            resetTokenExpiresAt: new Date(Date.now() + 15 * 60_000),
            updatedAt: new Date(),
          },
        },
      );

      return res.status(200).json({ message: 'Mã xác nhận hợp lệ.', resetToken });
    }

    if (endpoint === 'reset-password') {
      const { email, resetToken, newPassword } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanResetToken = String(resetToken || '').trim();
      const passwordStr = String(newPassword || '');

      if (!cleanEmail || !cleanResetToken || !passwordStr) {
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin.' });
      }

      if (passwordStr.length < 8) {
        return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
      }

      const record = await db.collection('passwordresets').findOne({ email: cleanEmail });
      if (
        !record ||
        !record.verified ||
        !record.resetTokenHash ||
        !record.resetTokenExpiresAt ||
        new Date() > new Date(record.resetTokenExpiresAt)
      ) {
        return res.status(400).json({ message: 'Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.' });
      }

      const expectedTokenHash = crypto.createHmac('sha256', secret).update(cleanResetToken).digest('hex');
      if (expectedTokenHash !== record.resetTokenHash) {
        return res.status(400).json({ message: 'Token đặt lại mật khẩu không chính xác.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(passwordStr, salt);

      await db.collection('users').updateOne(
        { email: cleanEmail },
        {
          $set: {
            password: hashedPassword,
            salt,
            updatedAt: new Date(),
          },
        },
      );

      await db.collection('passwordresets').deleteOne({ email: cleanEmail });

      return res.status(200).json({ message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' });
    }
  } catch (err) {
    console.error('Password reset handler error:', err);
    return res.status(500).json({ message: 'Lỗi server khi xử lý đặt lại mật khẩu.' });
  }
};

