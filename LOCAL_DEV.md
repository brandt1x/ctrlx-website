# Local Development

## Account / Checkout (404 fix)

If you see **"Failed to load config (404)"** on the account page:

1. **Create `.env.local`** from the example:
   ```
   cp .env.local.example .env.local
   ```

2. **Edit `.env.local`** and set:
   - `SUPABASE_URL` – Supabase project URL (Settings → API)
   - `SUPABASE_ANON_KEY` – Supabase anon/public key (Settings → API)

3. **Run with Vercel:**
   ```
   vercel dev
   ```
   or
   ```
   npm run dev
   ```

**Do not** use `npx serve`, `python -m http.server`, or open HTML files directly. The `/api/supabase-config` route only works when running `vercel dev`.
