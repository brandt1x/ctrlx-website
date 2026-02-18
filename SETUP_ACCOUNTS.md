# Account Setup for Secure Downloads

This guide covers the manual steps to enable user accounts:

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. In **Authentication > Providers**, enable **Email** (and optionally Google/GitHub)
3. In **SQL Editor**, run the contents of `supabase/schema.sql`
4. In **Settings > API**, copy:
   - Project URL
   - anon/public key
   - service_role key (keep secret)

### Supabase email setup (signup confirmation)

If users are not receiving signup confirmation emails:

| Cause | Solution |
|-------|----------|
| **Built-in provider limit** | Supabase's default email is for demo only (~2/hour). Use custom SMTP for production. |
| **Spam folder** | Ask users to check spam/junk. |
| **Domain blocking** | Emails from `supabase.io` can be blocked. Use custom SMTP with your domain. |

**Options:**

- **Disable confirmation (dev):** In **Authentication > Providers > Email**, turn off "Confirm email". Users can sign in immediately without confirming.
- **Custom SMTP (production):** In **Project Settings > Auth > SMTP**, configure SendGrid, Mailgun, Resend, or another provider. See [Supabase SMTP docs](https://supabase.com/docs/guides/auth/auth-smtp).

## 2. Vercel Environment Variables

Add these in your Vercel project settings:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |

### Local development (required for account/checkout)

1. **Copy env file:** `cp .env.local.example .env.local` (or copy manually)
2. **Edit `.env.local`** and set at minimum:
   - `SUPABASE_URL` – from Supabase Dashboard → Settings → API → Project URL
   - `SUPABASE_ANON_KEY` – from Supabase Dashboard → Settings → API → anon public key
3. **Run:** `vercel dev` or `npm run dev` (do NOT use a static server like `npx serve` – API routes need `vercel dev`)

## 3. Stripe Webhook

1. In [Stripe Dashboard](https://dashboard.stripe.com/webhooks), click **Add endpoint**
2. URL: `https://your-domain.com/api/stripe-webhook`
3. Events: **checkout.session.completed**
4. Copy the **Signing secret** (starts with `whsec_`)

## 4. Vercel Environment Variables (Stripe)

| Variable | Value |
|----------|-------|
| `STRIPE_WEBHOOK_SECRET` | Your webhook signing secret |

## 5. Redeploy

Redeploy your site after adding all environment variables.

---

## How account and purchase tracking works

Accounts and purchases are already tracked. No extra setup is required.

**Data flow:**

1. **Sign up** – Supabase Auth creates a row in `auth.users`. Each user gets a unique `id` (UUID).
2. **Checkout** – `create-checkout-session` passes `user_id: user.id` in Stripe session metadata.
3. **Webhook** – When Stripe sends `checkout.session.completed`, the webhook reads `user_id` from metadata and inserts into the `purchases` table with `user_id`, `session_id`, and `items`.
4. **Storage** – The `purchases` table (`supabase/schema.sql`) has `user_id` referencing `auth.users(id)`. Row Level Security (RLS) ensures users only see their own purchases.
5. **Retrieval** – The `my-purchases` API fetches `purchases` where `user_id = auth.uid()`.

Each purchase is tied to the signed-in user. Users see only their own purchases and downloads.

---

## Flow Summary

- Users add items to cart (no login)
- Clicking **Checkout** requires sign-in; if not logged in, redirects to `/account.html`
- After sign-in, user returns and can checkout
- Stripe redirects to `/account.html` after payment
- Webhook stores the purchase in Supabase with `user_id`
- User sees purchases and downloads in their account

---

## Troubleshooting: Purchases not showing after payment

If users pay but don't see purchases or download links:

| Check | Action |
|-------|--------|
| **Webhook configured** | Stripe Dashboard → Webhooks → ensure endpoint URL is `https://www.cntrl-x.com/api/stripe-webhook` (or your domain) |
| **Webhook secret** | `STRIPE_WEBHOOK_SECRET` in Vercel must match the webhook's signing secret |
| **Webhook events** | Endpoint must listen for `checkout.session.completed` |
| **Webhook logs** | Stripe Dashboard → Webhooks → your endpoint → Recent deliveries. Check for 4xx/5xx responses |
| **Supabase schema** | Run `supabase/schema.sql` in Supabase SQL Editor to create the `purchases` table |
| **Env vars** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` must be set in Vercel |

The account page now polls for purchases when returning from checkout (webhook can take a few seconds). If purchases still don't appear after ~20 seconds, the webhook is likely failing.
