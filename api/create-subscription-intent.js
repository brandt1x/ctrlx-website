const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getUserFromRequest } = require('../lib/auth-helpers');
const { getProduct } = require('../lib/products');
const { checkRateLimit } = require('../lib/rate-limit');

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

async function getOrCreateRecurringPriceId(productId) {
	if (productId === 'vision-x-monthly') {
		const envPriceId = process.env.STRIPE_VISION_X_MONTHLY_PRICE_ID;
		if (envPriceId) return envPriceId;
	}

	const product = getProduct(productId);
	if (!product || !product.recurring) return null;
	const unitAmount = Math.round(product.price * 100);

	const products = await stripe.products.list({ limit: 100, active: true });
	const existing = products.data.find((p) => p.metadata?.product_id === productId);
	if (existing) {
		const prices = await stripe.prices.list({
			product: existing.id,
			active: true,
			limit: 10,
		});
		const match = prices.data.find(
			(pr) => pr.recurring?.interval === product.recurring && pr.unit_amount === unitAmount
		);
		if (match) return match.id;
	}

	const stripeProduct = existing || await stripe.products.create({
		name: product.name,
		metadata: { product_id: productId },
	});
	const price = await stripe.prices.create({
		product: stripeProduct.id,
		unit_amount: unitAmount,
		currency: 'usd',
		recurring: { interval: product.recurring },
	});
	return price.id;
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

	const requestedId = (req.body && req.body.productId) || 'vision-x-monthly';
	const catalogEntry = getProduct(requestedId);
	if (!catalogEntry || !catalogEntry.recurring) {
		return res.status(400).json({ error: 'Invalid subscription product.' });
	}

	let priceId;
	try {
		priceId = await getOrCreateRecurringPriceId(requestedId);
	} catch (err) {
		console.error('Failed to get/create recurring price for', requestedId, err);
		return res.status(500).json({ error: 'Subscription not available. Please contact support.' });
	}
	if (!priceId) {
		return res.status(500).json({ error: 'Subscription not available. Please contact support.' });
	}

	const unitAmount = Math.round(catalogEntry.price * 100);

	try {
		const customer = await getOrCreateCustomerByEmail(
			user.email,
			user.user_metadata?.full_name || user.user_metadata?.name || undefined,
			{ user_id: user.id }
		);

		const subscription = await stripe.subscriptions.create({
			customer: customer.id,
			items: [{ price: priceId, quantity: 1 }],
			payment_behavior: 'default_incomplete',
			payment_settings: {
				save_default_payment_method: 'on_subscription',
				payment_method_types: ['card', 'link', 'cashapp', 'us_bank_account'],
			},
			expand: ['latest_invoice.payment_intent'],
			metadata: { user_id: user.id, product_id: requestedId },
		});

		const paymentIntent = subscription.latest_invoice?.payment_intent;
		if (!paymentIntent || !paymentIntent.client_secret) {
			console.error('Subscription created but no payment intent:', subscription.id);
			return res.status(500).json({ error: 'Failed to initialize subscription payment.' });
		}

		return res.json({
			clientSecret: paymentIntent.client_secret,
			amount: unitAmount,
			currency: 'usd',
			subscriptionId: subscription.id,
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: err.message || 'Subscription checkout failed.' });
	}
};
