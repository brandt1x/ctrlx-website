const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { getUserFromRequest } = require('../lib/auth-helpers');

async function persistSubscriptionRecord(supabase, row) {
	const { error } = await supabase.from('subscriptions').upsert(row, {
		onConflict: 'stripe_subscription_id',
	});
	if (!error || error.code === '23505') return null;

	const { data: existing, error: existingError } = await supabase
		.from('subscriptions')
		.select('id')
		.eq('user_id', row.user_id)
		.eq('product_id', row.product_id)
		.limit(1)
		.maybeSingle();
	if (existingError || !existing?.id) {
		return error;
	}

	const { error: updateError } = await supabase
		.from('subscriptions')
		.update({
			stripe_subscription_id: row.stripe_subscription_id,
			status: row.status,
			current_period_end: row.current_period_end,
			updated_at: row.updated_at,
		})
		.eq('id', existing.id);
	return updateError || null;
}

function normalizeStatus(subscriptionStatus, paymentIntentStatus) {
	if (paymentIntentStatus === 'succeeded') return 'active';
	if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') return 'active';
	if (subscriptionStatus === 'past_due') return 'active';
	return subscriptionStatus;
}

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

		const subscription = await stripe.subscriptions.retrieve(subId, {
			expand: ['customer'],
		});
		const subUserId = subscription.metadata?.user_id || '';
		const customerEmail = typeof subscription.customer === 'object'
			? String(subscription.customer?.email || '').trim().toLowerCase()
			: '';
		const userEmail = String(user.email || '').trim().toLowerCase();
		const ownsByEmail = !!customerEmail && !!userEmail && customerEmail === userEmail;
		if ((!subUserId || subUserId !== user.id) && !ownsByEmail) {
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
		const status = normalizeStatus(subscription.status, paymentIntent.status);

		const row = {
			user_id: user.id,
			stripe_subscription_id: subscription.id,
			product_id: subscription.metadata?.product_id || 'vision-x-monthly',
			status,
			current_period_end: periodEnd,
			updated_at: new Date().toISOString(),
		};
		const error = await persistSubscriptionRecord(supabase, row);

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
