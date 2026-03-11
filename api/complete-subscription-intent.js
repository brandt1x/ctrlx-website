const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { getUserFromRequest } = require('../lib/auth-helpers');

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
		if (!paymentIntent.invoice) {
			return res.status(400).json({ error: 'No subscription invoice found for this payment' });
		}

		const invoice = await stripe.invoices.retrieve(paymentIntent.invoice);
		const subId = invoice.subscription;
		if (!subId) {
			return res.status(400).json({ error: 'No subscription found for this invoice' });
		}

		const subscription = await stripe.subscriptions.retrieve(subId);
		const subUserId = subscription.metadata?.user_id || '';
		if (!subUserId || subUserId !== user.id) {
			return res.status(403).json({ error: 'Subscription does not belong to current user' });
		}

		const supabaseUrl = process.env.SUPABASE_URL;
		const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		if (!supabaseUrl || !supabaseServiceKey) {
			return res.status(500).json({ error: 'Server configuration error' });
		}
		const supabase = createClient(supabaseUrl, supabaseServiceKey);
		const periodEnd = subscription.current_period_end
			? new Date(subscription.current_period_end * 1000).toISOString()
			: null;
		const status = subscription.status === 'active' || subscription.status === 'trialing'
			? 'active'
			: subscription.status;

		const { error } = await supabase.from('subscriptions').upsert({
			user_id: user.id,
			stripe_subscription_id: subscription.id,
			product_id: subscription.metadata?.product_id || 'vision-x-monthly',
			status,
			current_period_end: periodEnd,
			updated_at: new Date().toISOString(),
		}, { onConflict: 'stripe_subscription_id' });

		if (error) {
			console.error('Failed to upsert subscription:', error);
			return res.status(500).json({ error: 'Failed to record subscription' });
		}

		return res.json({ ok: true, subscription_id: subscription.id });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: err.message || 'Failed to finalize subscription' });
	}
};
