# Vercel Deployment Troubleshooting

The diagnostic script confirmed your **local project is fine** (vercel.json valid, API files load, deps present). If Vercel still isn't deploying, work through these steps.

---

## Step 1: Confirm GitHub Integration

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Open your project (e.g. **ctrlx-website**)
3. Go to **Settings** → **Git**
4. Check:
   - **Connected Git Repository**: Should show `brandt1x/ctrlx-website` (or your repo)
   - **Production Branch**: Should be `main`
   - **Deploy Hooks**: Optional

If the repo is disconnected or wrong, click **Connect Git Repository** and reconnect.

---

## Step 2: Check Deployment Status

1. In your Vercel project, go to **Deployments**
2. Look at the latest deployment:
   - **Building** = Vercel received the push, wait for it
   - **Failed** = Click it and open **Build Logs** to see the error
   - **No new deployment** = Vercel may not be receiving pushes (Step 3)

---

## Step 3: Reconnect GitHub (if no deployments)

If pushes to `main` don't create new deployments:

1. **Settings** → **Git** → **Disconnect** (temporarily)
2. Click **Connect Git Repository**
3. Choose **GitHub** → select `brandt1x/ctrlx-website`
4. Ensure **Production Branch** = `main`
5. Save

---

## Step 4: Trigger a Manual Deploy

1. Go to **Deployments**
2. Click the **...** menu on the latest deployment
3. Click **Redeploy**
4. If it says "This deployment cannot be redeployed", push a **new commit** to `main`:

   ```bash
   git add .
   git commit -m "Trigger Vercel deploy"
   git push origin main
   ```

---

## Step 5: Inspect Build Logs (if build fails)

1. Open the failed deployment
2. Click **View Build Logs** or **View Function Logs**
3. Look for:
   - Schema errors (e.g. `bodyParser` – already fixed)
   - Missing env vars
   - `npm install` or module errors
   - Function size limits

---

## Step 6: Verify Environment Variables

1. **Settings** → **Environment Variables**
2. Ensure these exist for **Production**:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

Missing vars can cause runtime errors; some can also affect the build.

---

## Quick Checklist

- [ ] Git repo connected in Vercel
- [ ] Production branch = `main`
- [ ] Latest deployment status checked
- [ ] Build logs reviewed if failed
- [ ] Env vars set for Production
- [ ] New commit pushed if redeploy blocked
