const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Get the authenticated user from the request.
 * Expects Authorization: Bearer <supabase_jwt>
 * @returns {{ id: string } | null}
 */
async function getUserFromRequest(req) {
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}
	const token = authHeader.slice(7);
	if (!token) return null;

	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !supabaseServiceKey) {
		console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
		return null;
	}

	const supabase = createClient(supabaseUrl, supabaseServiceKey);
	const { data: { user }, error } = await supabase.auth.getUser(token);
	if (error || !user) return null;
	return user;
}

/**
 * Check if the given user_id owns the given session_id (purchase record exists).
 */
async function userOwnsSession(userId, sessionId) {
	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !supabaseServiceKey) return false;

	const supabase = createClient(supabaseUrl, supabaseServiceKey);
	const { data, error } = await supabase
		.from('purchases')
		.select('id')
		.eq('user_id', userId)
		.eq('session_id', sessionId)
		.maybeSingle();

	return !error && !!data;
}

/**
 * Get the purchase (items) for a session if the user owns it.
 * @returns {{ items: Array } | null}
 */
async function getOwnedPurchase(userId, sessionId) {
	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !supabaseServiceKey) return null;

	const supabase = createClient(supabaseUrl, supabaseServiceKey);
	const { data, error } = await supabase
		.from('purchases')
		.select('items, created_at')
		.eq('user_id', userId)
		.eq('session_id', sessionId)
		.maybeSingle();

	if (error || !data) return null;
	const items = Array.isArray(data.items) ? data.items : [];
	return { items, created_at: data.created_at };
}

/**
 * Check if user has an active subscription for the given product (e.g. vision-x-monthly).
 */
async function hasActiveSubscription(userId, productId, userEmail) {
	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !supabaseServiceKey) return false;

	const supabase = createClient(supabaseUrl, supabaseServiceKey);
	const { data, error } = await supabase
		.from('subscriptions')
		.select('id')
		.eq('user_id', userId)
		.eq('product_id', productId)
		.eq('status', 'active')
		.maybeSingle();

	if (!error && !!data) return true;

	const email = String(userEmail || '').trim().toLowerCase();
	if (!email || !process.env.STRIPE_SECRET_KEY) return false;

	try {
		const customers = await stripe.customers.list({ email, limit: 10 });
		for (const customer of customers.data || []) {
			const subs = await stripe.subscriptions.list({
				customer: customer.id,
				status: 'all',
				limit: 100,
				expand: ['data.latest_invoice.payment_intent'],
			});
			for (const sub of subs.data || []) {
				const subProductId = sub.metadata?.product_id || 'vision-x-monthly';
				if (subProductId !== productId) continue;

				const paymentIntentStatus = sub.latest_invoice?.payment_intent?.status || '';
				const hasAccess =
					sub.status === 'active' ||
					sub.status === 'trialing' ||
					sub.status === 'past_due' ||
					paymentIntentStatus === 'succeeded';
				if (!hasAccess) continue;

				const periodEnd = sub.current_period_end
					? new Date(sub.current_period_end * 1000).toISOString()
					: null;
				await supabase.from('subscriptions').upsert({
					user_id: userId,
					stripe_subscription_id: sub.id,
					product_id: subProductId,
					status: 'active',
					current_period_end: periodEnd,
					updated_at: new Date().toISOString(),
				}, { onConflict: 'stripe_subscription_id' });
				return true;
			}
		}
	} catch (stripeErr) {
		console.error('hasActiveSubscription stripe fallback error:', stripeErr);
	}

	return false;
}

module.exports = { getUserFromRequest, userOwnsSession, getOwnedPurchase, hasActiveSubscription };
