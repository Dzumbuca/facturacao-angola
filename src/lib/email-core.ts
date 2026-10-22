import nodemailer, { type Transporter } from 'nodemailer';

export type EmailConfiguration = {
  host: string;
  port: number;
  secure: boolean;
  fromName: string;
  fromAddress: string;
  appUrl: string;
};

type EmailEnvironment = Record<string, string | undefined>;
export type EmailActionPurpose = 'VERIFY_EMAIL' | 'PASSWORD_RESET';
type ConfigurationResult = { ok: true; config: EmailConfiguration } | { ok: false; missing?: string[]; invalid?: string[]; insecureProductionUrl?: true };
const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM_NAME', 'EMAIL_FROM', 'APP_URL'] as const;
const addressPattern = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

export function parseEmailConfiguration(env: EmailEnvironment, nodeEnv = 'development'): ConfigurationResult {
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) return { ok: false, missing: [...missing] };
  const invalid: string[] = [];
  const port = Number(env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) invalid.push('SMTP_PORT');
  const secure = env.SMTP_SECURE?.trim().toLowerCase();
  if (secure !== 'true' && secure !== 'false') invalid.push('SMTP_SECURE');
  if (!addressPattern.test(env.EMAIL_FROM!.trim())) invalid.push('EMAIL_FROM');
  if (!addressPattern.test(env.SMTP_USER!.trim())) invalid.push('SMTP_USER');
  if (!env.EMAIL_FROM_NAME!.trim() || env.EMAIL_FROM_NAME!.trim().length > 120) invalid.push('EMAIL_FROM_NAME');
  let appUrl: URL;
  try {
    appUrl = new URL(env.APP_URL!.trim());
    if (!['http:', 'https:'].includes(appUrl.protocol) || appUrl.username || appUrl.password || appUrl.search || appUrl.hash) invalid.push('APP_URL');
  } catch { invalid.push('APP_URL'); }
  if (invalid.length) return { ok: false, invalid: [...new Set(invalid)] };
  if (nodeEnv === 'production' && appUrl!.protocol !== 'https:') return { ok: false, insecureProductionUrl: true };
  return { ok: true, config: {
    host: env.SMTP_HOST!.trim(), port, secure: secure === 'true', fromName: env.EMAIL_FROM_NAME!.trim(),
    fromAddress: env.EMAIL_FROM!.trim(), appUrl: appUrl!.toString().replace(/\/$/, ''),
  } };
}

export function sanitizeSmtpError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : '';
  if (code === 'EAUTH' || code === '535' || code === 'EENVELOPE') return 'SMTP_AUTH';
  if (['ETIMEDOUT', 'ECONNECTION', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENOTFOUND', 'ESOCKET'].includes(code)) return 'SMTP_CONNECTION';
  return 'SMTP_SEND_FAILURE';
}

export function getEmailConfiguration(env: EmailEnvironment = process.env): ConfigurationResult {
  return parseEmailConfiguration(env, process.env.NODE_ENV);
}

type TransportResult =
  | { ok: true; transporter: Transporter; config: EmailConfiguration }
  | { ok: false; missing?: string[]; invalid?: string[]; insecureProductionUrl?: true };

function createTransport(): TransportResult {
  const result = getEmailConfiguration();
  if (!result.ok) return result;
  const transporter = nodemailer.createTransport({
    host: result.config.host,
    port: result.config.port,
    secure: result.config.secure,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    tls: { minVersion: 'TLSv1.2', servername: result.config.host },
  });
  return { ok: true, transporter, config: result.config };
}

export async function verifySmtpConnection() {
  const transport = createTransport();
  if (!transport.ok) return { ok: false as const, code: 'SMTP_CONFIGURATION', missing: transport.missing, invalid: transport.invalid, insecureProductionUrl: transport.insecureProductionUrl };
  try {
    await transport.transporter.verify();
    return { ok: true as const, code: 'SMTP_READY' };
  } catch (error) {
    return { ok: false as const, code: sanitizeSmtpError(error) };
  } finally {
    transport.transporter.close();
  }
}

export type EmailMessage = { to: string; subject: string; text: string; html?: string; attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>; headers?: Record<string, string> };
export async function sendSmtpEmail(message: EmailMessage) {
  const transport = createTransport();
  if (!transport.ok) return { ok: false as const, code: 'SMTP_CONFIGURATION' };
  if (!addressPattern.test(message.to) || /[\r\n]/.test(message.to) || /[\r\n]/.test(message.subject)) return { ok: false as const, code: 'INVALID_MESSAGE' };
  try {
    const result = await transport.transporter.sendMail({
      from: { name: transport.config.fromName, address: transport.config.fromAddress },
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments,
      headers: message.headers,
    });
    return { ok: true as const, accepted: result.accepted.length > 0 };
  } catch (error) {
    return { ok: false as const, code: sanitizeSmtpError(error) };
  } finally {
    transport.transporter.close();
  }
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function createPublicEmailUrl(path: string, token?: string, env: EmailEnvironment = process.env) {
  const result = parseEmailConfiguration(env, process.env.NODE_ENV);
  if (!result.ok) throw new Error('Email configuration unavailable');
  const url = new URL(path, result.config.appUrl);
  if (token) url.hash = `token=${encodeURIComponent(token)}`;
  return url.toString();
}
