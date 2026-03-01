const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getUserFromRequest } = require('./_auth-helpers');
const { getProduct } = require('./_products');
const { checkRateLimit } = require('./_rate-limit');

const PROMO_CODES = ['2000!'];
const PROMO_CUTOFF = new Date('2026-02-28T00:00:00Z');

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

	const { productIds, promoCode } = req.body || {};
	if (!Array.isArray(productIds) || productIds.length === 0) {
		return res.status(400).json({ error: 'Invalid or empty cart. Use valid product IDs only.' });
	}

	const items = [];
	let amountCents = 0;
	for (const id of productIds) {
		const product = getProduct(id);
		if (!product) return res.status(400).json({ error: 'Invalid product in cart.' });
		items.push({ product_id: id, name: product.name, price: product.price });
		amountCents += Math.round(product.price * 100);
	}

	const normalizedPromo = promoCode && String(promoCode).toUpperCase().trim();
	const isPromoValid = normalizedPromo && PROMO_CODES.includes(normalizedPromo) && new Date() < PROMO_CUTOFF;
	if (promoCode && !isPromoValid) {
		if (PROMO_CODES.includes(normalizedPromo)) {
			return res.status(400).json({ error: 'Promo has expired.' });
		}
		return res.status(400).json({ error: 'Invalid promo code.' });
	}

	if (isPromoValid) {
		amountCents = Math.round(amountCents * 0.5);
	}
	if (amountCents <= 0) {
		return res.status(400).json({ error: 'Cart total is invalid.' });
	}

	try {
		const paymentIntent = await stripe.paymentIntents.create({
			amount: amountCents,
			currency: 'usd',
			payment_method_types: ['card'],
			metadata: {
				user_id: user.id,
				items: JSON.stringify(items),
				promo_code: isPromoValid ? normalizedPromo : '',
			},
		});

		return res.json({
			clientSecret: paymentIntent.client_secret,
			amount: amountCents,
			currency: 'usd',
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: err.message || 'Checkout initialization failed.' });
	}
};
