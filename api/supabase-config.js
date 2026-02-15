module.exports = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const url = process.env.SUPABASE_URL;
	const anonKey = process.env.SUPABASE_ANON_KEY;
	if (!url || !anonKey) {
		return res.status(500).json({ error: 'Supabase not configured' });
	}
	// Use production URL for OAuth redirect (avoids localhost after Google sign-in)
	const siteUrl = process.env.SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
	res.json({ url, anonKey, siteUrl });
};
