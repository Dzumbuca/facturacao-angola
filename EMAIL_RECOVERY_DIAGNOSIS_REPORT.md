# Password Recovery Email — Diagnosis Report

## Root cause
SMTP environment variables are NOT defined in .env (.env contains only APP_URL). email-core.ts requires: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM_NAME, EMAIL_FROM, APP_URL. Missing all SMTP_* and EMAIL_FROM_* → sendSmtpEmail returns { ok: false, code: 'SMTP_CONFIGURATION' } → recorded as FAILED in EmailDelivery. Route swallowed the result and returned success message, so user saw "email sent" but nothing was sent.

## Files involved
- src/app/api/auth/forgot-password/route.ts — swallowed send result; now logs failure code server-side.
- src/lib/email-actions.ts — sendEmailActionToken calls sendAndRecordEmail → sendSmtpEmail.
- src/lib/email-core.ts — parseEmailConfiguration requires SMTP_* env vars; verifySmtpConnection available for connectivity test.

## What's missing to make it work
Set in .env (or .env.playwright for staging tests):
SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM_NAME, EMAIL_FROM, APP_URL.

## Logging change
Route now calls console.error with the failure code when sendEmailActionToken returns not-ok. No secrets/tokens logged.

## SMTP connectivity test
Use verifySmtpConnection() from src/lib/email-core.ts (exported). Returns { ok, code }.
