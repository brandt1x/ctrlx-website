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

## 2. Vercel Environment Variables

Add these in your Vercel project settings:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |

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

## Flow Summary

- Users add items to cart (no login)
- Clicking **Checkout** requires sign-in; if not logged in, redirects to `/account.html`
- After sign-in, user returns and can checkout
- Stripe redirects to `/account.html` after payment
- Webhook stores the purchase in Supabase
- User sees purchases and downloads in their account
