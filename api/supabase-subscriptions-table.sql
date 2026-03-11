-- Subscriptions table for Vision-X monthly and future recurring products.
-- Run this in Supabase SQL Editor.
--
-- Stripe setup:
-- 1. Create a Product "VISION-X Monthly" in Stripe Dashboard.
-- 2. Add a recurring Price $100/month, copy the Price ID (price_xxx).
-- 3. Set STRIPE_VISION_X_MONTHLY_PRICE_ID in Vercel env.
-- 4. Add webhook events: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted.

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL UNIQUE,
  product_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
