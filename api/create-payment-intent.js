const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getUserFromRequest } = require('./_auth-helpers');
const { getProduct } = require('./_products');
const { checkRateLimit } = require('./_rate-limit');

const PROMO_DISCOUNTS = { '2000!': 0.5, 'GOAT': 0.8 };
const PROMO_CUTOFFS = { '2000!': new Date('2026-02-28T00:00:00Z'), 'GOAT': new Date('2026-03-10T03:59:59Z') };
const PROMO_CODES = Object.keys(PROMO_DISCOUNTS);

function isValidEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

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
	const { productIds, promoCode, customerEmail } = req.body || {};
	if (!Array.isArray(productIds) || productIds.length === 0) {
		return res.status(400).json({ error: 'Invalid or empty cart. Use valid product IDs only.' });
	}

	const signedInEmail = user && user.email ? String(user.email).trim().toLowerCase() : '';
	const guestEmail = String(customerEmail || '').trim().toLowerCase();
	const effectiveEmail = signedInEmail || guestEmail;
	if (!effectiveEmail || !isValidEmail(effectiveEmail)) {
		return res.status(400).json({ error: 'A valid email is required for checkout.' });
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
	const cutoff = normalizedPromo && PROMO_CUTOFFS[normalizedPromo];
	const isPromoValid = normalizedPromo && PROMO_CODES.includes(normalizedPromo) && cutoff && new Date() < cutoff;
	if (promoCode && !isPromoValid) {
		if (PROMO_CODES.includes(normalizedPromo)) {
			return res.status(400).json({ error: 'Promo has expired.' });
		}
		return res.status(400).json({ error: 'Invalid promo code.' });
	}

	if (isPromoValid) {
		const multiplier = PROMO_DISCOUNTS[normalizedPromo] ?? 1;
		amountCents = Math.round(amountCents * multiplier);
	}
	if (amountCents <= 0) {
		return res.status(400).json({ error: 'Cart total is invalid.' });
	}

	try {
		const customer = await getOrCreateCustomerByEmail(
			effectiveEmail,
			user?.user_metadata?.full_name || user?.user_metadata?.name || undefined,
			user ? { user_id: user.id } : { checkout_type: 'guest' }
		);

		const paymentIntent = await stripe.paymentIntents.create({
			amount: amountCents,
			currency: 'usd',
			payment_method_types: ['card'],
			customer: customer?.id || undefined,
			metadata: {
				user_id: user ? user.id : '',
				customer_email: effectiveEmail,
				checkout_type: user ? 'account' : 'guest',
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
