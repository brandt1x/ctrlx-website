const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getUserFromRequest } = require('./_auth-helpers');
const { validateAndBuildLineItems } = require('./_products');
const { checkRateLimit } = require('./_rate-limit');

const ALLOWED_ORIGINS = [
	'https://cntrl-x.com',
	'https://www.cntrl-x.com',
	'https://cntrl-x.vercel.app',
	'http://localhost:3000',
	'http://127.0.0.1:3000',
];

module.exports = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const allowed = await checkRateLimit(req, 'checkout');
	if (!allowed) {
		return res.status(429).json({ error: 'Too many requests. Please try again later.' });
	}

	const user = await getUserFromRequest(req);
	if (!user) {
		return res.status(401).json({ error: 'Sign in required to checkout' });
	}

	const { productIds } = req.body;
	const result = validateAndBuildLineItems(productIds);
	if (!result) {
		return res.status(400).json({ error: 'Invalid or empty cart. Use valid product IDs only.' });
	}

	const { lineItems, items } = result;

	try {
		const origin = (req.headers.origin || req.headers.referer || '').replace(/\/$/, '');
		const baseUrl = origin && ALLOWED_ORIGINS.includes(origin)
			? origin
			: (process.env.SITE_URL || 'https://cntrl-x.vercel.app').replace(/\/$/, '');

		const session = await stripe.checkout.sessions.create({
			line_items: lineItems,
			mode: 'payment',
			success_url: `${baseUrl}/account.html`,
			cancel_url: `${baseUrl}/`,
			metadata: {
				items: JSON.stringify(items),
				user_id: user.id,
			},
		});
		res.json({ url: session.url });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: err.message });
	}
};
