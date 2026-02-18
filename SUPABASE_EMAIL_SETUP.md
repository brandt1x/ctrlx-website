# Supabase Email Setup (Signup Confirmation)

If users are not receiving signup confirmation emails, use this guide.

## Quick fixes

1. **Check spam/junk** – Ask users to check their spam folder.
2. **Disable confirmation (dev only)** – In Supabase Dashboard: **Authentication > Providers > Email** → turn off "Confirm email". Users can sign in immediately without confirming.

---

## Option A: Custom SMTP (Recommended – Magic Link)

Supabase's built-in email provider is for demonstration only (~2 messages/hour). For production, configure custom SMTP.

### Resend (Free: 100 emails/day)

1. Create an account at [resend.com](https://resend.com)
2. Verify your domain (or use Resend's sandbox for testing)
3. Create an API key: **API Keys** → **Create API Key**
4. In Supabase Dashboard: **Project Settings** → **Auth** → **SMTP Settings**
5. Enable **Custom SMTP** and enter:

   | Field | Value |
   |-------|-------|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | Your Resend API key |
   | Sender email | e.g. `noreply@yourdomain.com` |
   | Sender name | e.g. `Control-X` |

6. Click **Save**

### URL configuration

In **Authentication** → **URL Configuration**:

- **Site URL:** `https://www.cntrl-x.com` (or your production URL)
- **Redirect URLs:** Add `https://www.cntrl-x.com/account.html` and `https://www.cntrl-x.com/**`

### Result

Users receive a magic link. Clicking it confirms the account and signs them in. No code changes needed.

---

## Option B: OTP (6-Digit Code)

Use a 6-digit code instead of a link. Useful if magic links are blocked (e.g. Microsoft Safe Links prefetches and consumes links).

### 1. Configure SMTP

Same as Option A – Supabase must be able to send emails.

### 2. Change email template

In Supabase: **Authentication** → **Email Templates** → **Confirm signup**

Replace the body to use the token instead of the link:

**Subject:** `Confirm your Control-X account`

**Body (HTML):**
```html
<h2>Verify your email</h2>
<p>Your verification code is: <strong>{{ .Token }}</strong></p>
<p>Enter this 6-digit code on the signup page to confirm your account.</p>
<p>This code expires in 1 hour.</p>
```

### 3. Verify step (already implemented)

The account page shows a "Verify your email" step after signup. Users enter the 6-digit code and click Verify.

---

## Common causes

| Cause | Solution |
|-------|----------|
| Built-in provider rate limit | Use custom SMTP |
| Emails from `supabase.io` blocked | Use custom SMTP with your domain |
| Firewall blocking "verification" emails | Use custom SMTP; check provider logs |
| Magic link consumed before click | Use Option B (OTP) |
| Wrong email in signup | User typo – no fix |

---

## Other providers

- **SendGrid:** [sendgrid.com](https://sendgrid.com) – free tier 100/day
- **Mailgun:** [mailgun.com](https://mailgun.com) – free tier available

See [Supabase SMTP docs](https://supabase.com/docs/guides/auth/auth-smtp) for details.
