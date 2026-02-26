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

	const { productIds, promoCode } = req.body;
	const result = validateAndBuildLineItems(productIds);
	if (!result) {
		return res.status(400).json({ error: 'Invalid or empty cart. Use valid product IDs only.' });
	}

	let { lineItems, items } = result;

	// Promo code 2000!: 50% off, valid until end of Feb 27, 2026 UTC
	const PROMO_CODES = ['2000!'];
	const PROMO_CUTOFF = new Date('2026-02-28T00:00:00Z');
	const normalizedPromo = promoCode && String(promoCode).toUpperCase().trim();
	const isPromoValid = normalizedPromo && PROMO_CODES.includes(normalizedPromo) && new Date() < PROMO_CUTOFF;
	if (promoCode && !isPromoValid) {
		if (PROMO_CODES.includes(normalizedPromo)) {
			return res.status(400).json({ error: 'Promo has expired.' });
		}
		return res.status(400).json({ error: 'Invalid promo code.' });
	}
	if (isPromoValid) {
		lineItems = lineItems.map((li) => ({
			...li,
			price_data: {
				...li.price_data,
				unit_amount: Math.round(li.price_data.unit_amount * 0.5),
			},
		}));
	}

	try {
		const origin = (req.headers.origin || req.headers.referer || '').replace(/\/$/, '');
		const baseUrl = origin && ALLOWED_ORIGINS.includes(origin)
			? origin
			: (process.env.SITE_URL || 'https://cntrl-x.vercel.app').replace(/\/$/, '');

		const session = await stripe.checkout.sessions.create({
			line_items: lineItems,
			mode: 'payment',
			success_url: `${baseUrl}/account.html?session_id={CHECKOUT_SESSION_ID}&success=1`,
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
