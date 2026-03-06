-- Run this in Supabase SQL Editor to create the license_keys table.
CREATE TABLE IF NOT EXISTS license_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_intent_id text UNIQUE NOT NULL,
  user_id text,
  email text NOT NULL,
  license_key text NOT NULL,
  product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  hwid text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_license_keys_payment ON license_keys (payment_intent_id);
CREATE INDEX idx_license_keys_email ON license_keys (email);
