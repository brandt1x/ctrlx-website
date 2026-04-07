/**
 * Combined config endpoint. Replaces stripe-config and supabase-config.
 * Returns both Supabase and Stripe config in one request.
 */
module.exports = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const url = process.env.SUPABASE_URL;
	const anonKey = process.env.SUPABASE_ANON_KEY;
	const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
	const siteUrl = process.env.SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

	if (!url || !anonKey) {
		return res.status(500).json({
			error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env.local (local) or Vercel env vars (production). Run with: vercel dev'
		});
	}

	res.json({ url, anonKey, siteUrl, publishableKey: publishableKey || '' });
};
