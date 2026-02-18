# Supabase Email Setup (Signup Confirmation)

If users are not receiving signup confirmation emails, use this guide.

## Quick fixes

1. **Check spam/junk** – Ask users to check their spam folder.
2. **Disable confirmation (dev only)** – In Supabase Dashboard: **Authentication > Providers > Email** → turn off "Confirm email". Users can sign in immediately without confirming.

## Production: Custom SMTP

Supabase's built-in email provider is for demonstration only (~2 messages/hour). For production, configure custom SMTP:

1. In Supabase Dashboard: **Project Settings > Auth > SMTP**
2. Enable "Custom SMTP"
3. Configure your provider (SendGrid, Mailgun, Resend, AWS SES, etc.)

Example providers:
- [SendGrid](https://sendgrid.com)
- [Mailgun](https://mailgun.com)
- [Resend](https://resend.com)

See [Supabase SMTP docs](https://supabase.com/docs/guides/auth/auth-smtp) for details.

## Common causes

| Cause | Solution |
|-------|----------|
| Built-in provider rate limit | Use custom SMTP |
| Emails from `supabase.io` blocked | Use custom SMTP with your domain |
| Firewall blocking "verification" emails | Use custom SMTP; check provider logs |
| Wrong email in signup | User typo – no fix |

## Email templates

Customize confirmation and password-reset emails in **Authentication > Email Templates**. Ensure confirmation links and tokens are correctly configured.
