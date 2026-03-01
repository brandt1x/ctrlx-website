module.exports = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}
	const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
	if (!publishableKey) {
		return res.status(500).json({ error: 'Stripe not configured. Missing STRIPE_PUBLISHABLE_KEY.' });
	}
	return res.json({ publishableKey });
};
