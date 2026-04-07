const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getUserFromRequest } = require('../lib/auth-helpers');
const { getProduct } = require('../lib/products');
const { checkRateLimit } = require('../lib/rate-limit');

const PROMO_RULES = {
	'2000!': { type: 'percent', value: 0.5, cutoff: new Date('2026-02-28T00:00:00Z') },
	'GOAT': { type: 'percent', value: 0.8, cutoff: new Date('2026-03-10T03:59:59Z') },
	'BUNDLEXP': {
		type: 'fixed',
		value: 485,
		cutoff: new Date('2026-03-23T03:59:59Z'),
		requiredProductIds: ['aim-x', 'vision-x-plus', '2k'],
	},
};

function isValidEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function getPromoRule(code) {
	const normalized = code && String(code).toUpperCase().trim();
	return normalized ? PROMO_RULES[normalized] || null : null;
}

function matchesRequiredBundle(rule, productIds) {
	if (!rule?.requiredProductIds?.length) return true;
	const cartIds = (productIds || []).map((id) => String(id || '').toLowerCase()).sort();
	const requiredIds = rule.requiredProductIds.slice().sort();
	if (cartIds.length !== requiredIds.length) return false;
	return requiredIds.every((id, index) => cartIds[index] === id);
}

function evaluatePromo(code, productIds, amountCents) {
	const normalized = code && String(code).toUpperCase().trim();
	const rule = getPromoRule(normalized);
	if (!normalized || !rule) return { valid: false, error: 'Invalid promo code.' };
	if (!(rule.cutoff instanceof Date) || new Date() >= rule.cutoff) {
		return { valid: false, error: 'Promo has expired.' };
	}
	if (!matchesRequiredBundle(rule, productIds)) {
		return { valid: false, error: 'BUNDLEXP requires VISION+X, AIM-X, and 2K Zen Script in the same cart.' };
	}

	const rawDiscountCents = rule.type === 'fixed'
		? Math.round(rule.value * 100)
		: Math.round(amountCents * (1 - (rule.value ?? 1)));
	const discountCents = Math.max(0, Math.min(amountCents, rawDiscountCents));
	return { valid: true, code: normalized, discountCents };
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

	const hasCheatProduct = productIds.some((id) => String(id).startsWith('cheat-'));
	if (hasCheatProduct && !user) {
		return res.status(401).json({ error: 'Sign in required to purchase PC cheats.' });
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

	const promoEval = promoCode ? evaluatePromo(promoCode, productIds, amountCents) : { valid: false };
	if (promoCode && !promoEval.valid) {
		return res.status(400).json({ error: promoEval.error || 'Invalid promo code.' });
	}

	if (promoEval.valid) {
		amountCents = Math.max(0, amountCents - promoEval.discountCents);
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
			payment_method_types: ['card', 'link', 'cashapp', 'us_bank_account'],
			customer: customer?.id || undefined,
			metadata: {
				user_id: user ? user.id : '',
				customer_email: effectiveEmail,
				checkout_type: user ? 'account' : 'guest',
				items: JSON.stringify(items),
				promo_code: promoEval.valid ? promoEval.code : '',
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
