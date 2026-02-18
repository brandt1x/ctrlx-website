const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const getRawBody = require('raw-body');

module.exports = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const sig = req.headers['stripe-signature'];
	const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
	if (!sig || !webhookSecret) {
		return res.status(400).json({ error: 'Missing signature or webhook secret' });
	}

	let payload;
	try {
		payload = await getRawBody(req, { encoding: 'utf8' });
	} catch (err) {
		console.error('Failed to read raw body:', err);
		return res.status(400).json({ error: 'Invalid body' });
	}

	let event;
	try {
		event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
	} catch (err) {
		console.error('Webhook signature verification failed:', err.message);
		return res.status(400).json({ error: `Webhook Error: ${err.message}` });
	}

	if (event.type !== 'checkout.session.completed') {
		return res.json({ received: true });
	}

	const session = event.data.object;
	const userId = session.metadata?.user_id;
	if (!userId) {
		console.warn('checkout.session.completed missing user_id in metadata');
		return res.json({ received: true });
	}

	let items = [];
	const metadataItems = session.metadata?.items;
	if (metadataItems) {
		try {
			const parsed = JSON.parse(metadataItems);
			if (Array.isArray(parsed) && parsed.length > 0) {
				items = parsed.map((i) => ({
					product_id: i.product_id || null,
					name: i.name || '',
					price: typeof i.price === 'number' ? i.price : 0,
				}));
			}
		} catch (_) {}
	}

	if (items.length === 0) {
		let sessionWithLineItems = session;
		if (!session.line_items?.data) {
			try {
				sessionWithLineItems = await stripe.checkout.sessions.retrieve(session.id, {
					expand: ['line_items', 'line_items.data.price.product'],
				});
			} catch (err) {
				console.error('Failed to retrieve session line_items:', err);
				return res.status(500).json({ error: 'Failed to retrieve purchase details' });
			}
		}
		const lineData = sessionWithLineItems.line_items?.data || [];
		for (const li of lineData) {
			const product = li.price?.product;
			const productId = typeof product === 'object' && product?.metadata?.product_id
				? product.metadata.product_id
				: null;
			const name = li.description || (typeof product === 'object' ? product?.name : '') || '';
			const price = (li.amount_total || 0) / 100;
			items.push(productId ? { product_id: productId, name, price } : { name, price });
		}
	}

	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !supabaseServiceKey) {
		console.error('Missing Supabase env vars');
		return res.status(500).json({ error: 'Server configuration error' });
	}

	const supabase = createClient(supabaseUrl, supabaseServiceKey);
	const { error } = await supabase.from('purchases').insert({
		user_id: userId,
		session_id: session.id,
		items,
	});

	if (error) {
		if (error.code === '23505') {
			// Unique violation - already inserted (idempotent)
			return res.json({ received: true });
		}
		console.error('Failed to insert purchase:', error);
		return res.status(500).json({ error: 'Failed to record purchase' });
	}

	res.json({ received: true });
};
