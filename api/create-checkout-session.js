const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getUserFromRequest } = require('../lib/auth-helpers');
const { validateAndBuildLineItems } = require('../lib/products');
const { checkRateLimit } = require('../lib/rate-limit');

const ALLOWED_ORIGINS = [
	'https://cntrl-x.com',
	'https://www.cntrl-x.com',
	'https://cntrl-x.vercel.app',
	'http://localhost:3000',
	'http://127.0.0.1:3000',
];

function isValidEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

async function getOrCreateCustomerByEmail(email, name, metadata) {
	const normalizedEmail = String(email || '').trim().toLowerCase();
	if (!normalizedEmail) return null;

	const existing = await stripe.customers.list({
		email: normalizedEmail,
		limit: 1,
	});
	if (existing.data && existing.data.length > 0) {
		return existing.data[0];
	}

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
	const result = validateAndBuildLineItems(productIds);
	if (!result) {
		return res.status(400).json({ error: 'Invalid or empty cart. Use valid product IDs only.' });
	}

	let { lineItems, items } = result;

	const PROMO_DISCOUNTS = { '2000!': 0.5, 'GOAT': 0.8 };
	const PROMO_CUTOFFS = { '2000!': new Date('2026-02-28T00:00:00Z'), 'GOAT': new Date('2026-03-10T03:59:59Z') };
	const PROMO_CODES = Object.keys(PROMO_DISCOUNTS);
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
		lineItems = lineItems.map((li) => ({
			...li,
			price_data: {
				...li.price_data,
				unit_amount: Math.round(li.price_data.unit_amount * multiplier),
			},
		}));
	}

	try {
		const origin = (req.headers.origin || req.headers.referer || '').replace(/\/$/, '');
		const baseUrl = origin && ALLOWED_ORIGINS.includes(origin)
			? origin
			: (process.env.SITE_URL || 'https://cntrl-x.vercel.app').replace(/\/$/, '');

		const signedInEmail = user && user.email ? String(user.email).trim().toLowerCase() : '';
		const guestEmail = String(customerEmail || '').trim().toLowerCase();
		const effectiveEmail = signedInEmail || guestEmail;
		if (!effectiveEmail || !isValidEmail(effectiveEmail)) {
			return res.status(400).json({ error: 'A valid email is required for checkout.' });
		}

		const metadata = {
			items: JSON.stringify(items),
			user_id: user ? user.id : '',
			customer_email: effectiveEmail,
			checkout_type: user ? 'account' : 'guest',
		};

		const sessionPayload = {
			line_items: lineItems,
			mode: 'payment',
			success_url: user
				? `${baseUrl}/account.html?session_id={CHECKOUT_SESSION_ID}&success=1`
				: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}&guest=1`,
			cancel_url: `${baseUrl}/checkout.html`,
			metadata,
		};

		if (user) {
			// Attach all purchases to a stable Stripe Customer per account.
			const customer = await getOrCreateCustomerByEmail(
				effectiveEmail,
				user.user_metadata?.full_name || user.user_metadata?.name || undefined,
				{ user_id: user.id }
			);
			if (customer && customer.id) {
				sessionPayload.customer = customer.id;
			}
		} else {
			// Guest checkout: reuse existing customer by email, or let Checkout collect it.
			const existingGuest = await stripe.customers.list({ email: effectiveEmail, limit: 1 });
			if (existingGuest.data && existingGuest.data[0] && existingGuest.data[0].id) {
				sessionPayload.customer = existingGuest.data[0].id;
			} else {
				sessionPayload.customer_creation = 'always';
			}
		}

		const session = await stripe.checkout.sessions.create(sessionPayload);
		res.json({ url: session.url });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: err.message });
	}
};
