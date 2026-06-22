import nodemailer from 'nodemailer';

export interface PasswordResetEmailOptions {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  appOrigin: string;
}

export function createPasswordResetSender(options: PasswordResetEmailOptions) {
  const transport = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure,
    auth: { user: options.user, pass: options.password },
  });
  return async (email: string, token: string) => {
    const resetUrl = `${options.appOrigin.replace(/\/$/, '')}/?resetToken=${encodeURIComponent(token)}`;
    await transport.sendMail({
      from: options.from,
      to: email,
      subject: '口琴练习室密码重置',
      text: `请在 15 分钟内打开以下链接重置密码：${resetUrl}`,
      html: `<p>请在 15 分钟内重置密码：</p><p><a href="${resetUrl}">重置密码</a></p><p>如果不是你发起的请求，请忽略此邮件。</p>`,
    });
  };
}
