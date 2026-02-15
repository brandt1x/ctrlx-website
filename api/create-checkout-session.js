const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getUserFromRequest } = require('./auth-helpers');

module.exports = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const user = await getUserFromRequest(req);
	if (!user) {
		return res.status(401).json({ error: 'Sign in required to checkout' });
	}

	const { items } = req.body;
	if (!items || !Array.isArray(items) || items.length === 0) {
		return res.status(400).json({ error: 'No items in cart' });
	}

	const line_items = items.map(item => ({
		price_data: {
			currency: 'usd',
			product_data: { name: item.name },
			unit_amount: Math.round((item.price || 0) * 100),
		},
		quantity: 1,
	}));

	try {
		const origin = req.headers.origin || req.headers.referer || '';
		const baseUrl = origin.replace(/\/$/, '') || 'https://cntrl-x.vercel.app';

		const session = await stripe.checkout.sessions.create({
			line_items,
			mode: 'payment',
			success_url: `${baseUrl}/account.html`,
			cancel_url: `${baseUrl}/`,
			metadata: {
				items: JSON.stringify(items.map(i => ({ name: i.name, price: i.price }))),
				user_id: user.id,
			},
		});
		res.json({ url: session.url });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: err.message });
	}
};
