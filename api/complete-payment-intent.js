const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { getUserFromRequest } = require('../lib/auth-helpers');
const { getOrCreateLicenseKey, sendLicenseEmail } = require('../lib/license');

module.exports = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const user = await getUserFromRequest(req);
	if (!user) {
		return res.status(401).json({ error: 'Sign in required' });
	}

	const paymentIntentId = req.body && req.body.payment_intent_id;
	if (!paymentIntentId) {
		return res.status(400).json({ error: 'Missing payment_intent_id' });
	}

	try {
		const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
		if (!paymentIntent || paymentIntent.status !== 'succeeded') {
			return res.status(400).json({ error: 'Payment not completed yet' });
		}

		const metaUserId = paymentIntent.metadata && paymentIntent.metadata.user_id;
		if (!metaUserId || metaUserId !== user.id) {
			return res.status(403).json({ error: 'Payment does not belong to current user' });
		}

		const supabaseUrl = process.env.SUPABASE_URL;
		const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		if (!supabaseUrl || !supabaseServiceKey) {
			return res.status(500).json({ error: 'Server configuration error' });
		}
		const supabase = createClient(supabaseUrl, supabaseServiceKey);

		let items = [];
		try {
			const parsed = JSON.parse((paymentIntent.metadata && paymentIntent.metadata.items) || '[]');
			if (Array.isArray(parsed)) {
				items = parsed.map((i) => ({
					product_id: i.product_id || null,
					name: i.name || '',
					price: typeof i.price === 'number' ? i.price : 0,
				}));
			}
		} catch (_) {}

		const { error } = await supabase.from('purchases').insert({
			user_id: user.id,
			session_id: paymentIntent.id,
			items,
		});
		if (error) {
			if (error.code === '23505') {
				return res.json({ ok: true, alreadyRecorded: true, session_id: paymentIntent.id });
			}
			console.error('Failed to insert purchase:', error);
			return res.status(500).json({ error: 'Failed to record purchase' });
		}

		const hasScripts = items.some((i) => {
			const pid = (i.product_id || '').toLowerCase();
			return pid !== 'vision-x' && pid !== 'vision-x-plus' && pid !== 'aim-x' && pid !== 'vision-setup';
		});
		if (hasScripts) {
			const customerEmail = paymentIntent.metadata?.customer_email || user.email || '';
			const productIds = items.map((i) => i.product_id).filter(Boolean);
			const productNames = items.map((i) => i.name).filter(Boolean);
			const licenseKey = await getOrCreateLicenseKey({
				paymentIntentId: paymentIntent.id,
				userId: user.id,
				email: customerEmail,
				productIds,
			});
			if (licenseKey && customerEmail) {
				await sendLicenseEmail(customerEmail, licenseKey, productNames);
			}
		}

		return res.json({ ok: true, session_id: paymentIntent.id });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: err.message || 'Failed to finalize payment' });
	}
};
