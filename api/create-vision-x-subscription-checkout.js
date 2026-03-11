const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getUserFromRequest } = require('./_auth-helpers');
const { checkRateLimit } = require('./_rate-limit');

const ALLOWED_ORIGINS = [
	'https://cntrl-x.com',
	'https://www.cntrl-x.com',
	'https://cntrl-x.vercel.app',
	'http://localhost:3000',
	'http://127.0.0.1:3000',
];

async function getOrCreateCustomerByEmail(email, name, metadata) {
	const normalizedEmail = String(email || '').trim().toLowerCase();
	if (!normalizedEmail) return null;
	const existing = await stripe.customers.list({ email: normalizedEmail, limit: 1 });
	if (existing.data && existing.data.length > 0) return existing.data[0];
	return stripe.customers.create({
		email: normalizedEmail,
		name: name || undefined,
		metadata: metadata || undefined,
	});
}

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
		return res.status(401).json({ error: 'Sign in required to subscribe' });
	}

	const priceId = process.env.STRIPE_VISION_X_MONTHLY_PRICE_ID;
	if (!priceId) {
		console.error('STRIPE_VISION_X_MONTHLY_PRICE_ID not configured');
		return res.status(500).json({ error: 'Subscription not available. Please contact support.' });
	}

	try {
		const origin = (req.headers.origin || req.headers.referer || '').replace(/\/$/, '');
		const baseUrl = origin && ALLOWED_ORIGINS.includes(origin)
			? origin
			: (process.env.SITE_URL || 'https://cntrl-x.vercel.app').replace(/\/$/, '');

		const customer = await getOrCreateCustomerByEmail(
			user.email,
			user.user_metadata?.full_name || user.user_metadata?.name || undefined,
			{ user_id: user.id }
		);

		const session = await stripe.checkout.sessions.create({
			mode: 'subscription',
			customer: customer?.id,
			line_items: [{ price: priceId, quantity: 1 }],
			success_url: `${baseUrl}/account.html?subscription=1&success=1`,
			cancel_url: `${baseUrl}/ultimate.html`,
			metadata: {
				user_id: user.id,
				product_id: 'vision-x-monthly',
			},
			subscription_data: {
				metadata: { user_id: user.id, product_id: 'vision-x-monthly' },
			},
		});

		if (session.url) {
			return res.json({ url: session.url });
		}
		res.status(500).json({ error: 'Failed to create checkout session' });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: err.message || 'Checkout failed' });
	}
};
