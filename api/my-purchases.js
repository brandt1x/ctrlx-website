const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getUserFromRequest } = require('../lib/auth-helpers');
const { getPurchaseFlags } = require('../lib/items-utils');
const { createClient } = require('@supabase/supabase-js');

async function syncSubscriptionsFromStripe(userId, userEmail) {
	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !supabaseServiceKey) return;
	const email = (userEmail || '').trim().toLowerCase();
	if (!email) return;
	try {
		const customers = await stripe.customers.list({ email, limit: 1 });
		const customer = customers.data?.[0];
		if (!customer) return;
		const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'active', limit: 20 });
		const supabase = createClient(supabaseUrl, supabaseServiceKey);
		for (const sub of subs.data || []) {
			const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
			const productId = sub.metadata?.product_id || 'vision-x-monthly';
			await supabase.from('subscriptions').upsert({
				user_id: userId,
				stripe_subscription_id: sub.id,
				product_id: productId,
				status: 'active',
				current_period_end: periodEnd,
				updated_at: new Date().toISOString(),
			}, { onConflict: 'stripe_subscription_id' });
		}
	} catch (err) {
		console.error('syncSubscriptionsFromStripe:', err);
	}
}

module.exports = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	try {
		const user = await getUserFromRequest(req);
		if (!user) {
			return res.status(401).json({ error: 'Sign in required' });
		}

		const supabaseUrl = process.env.SUPABASE_URL;
		const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		if (req.query?.sync === '1') {
			await syncSubscriptionsFromStripe(user.id, user.email);
		}
		if (!supabaseUrl || !supabaseServiceKey) {
			console.error('my-purchases: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
			return res.status(500).json({ error: 'Server configuration error' });
		}

		const supabase = createClient(supabaseUrl, supabaseServiceKey);
		const [{ data: rows, error }, { data: subRows }] = await Promise.all([
			supabase
				.from('purchases')
				.select('session_id, items, created_at')
				.eq('user_id', user.id)
				.order('created_at', { ascending: false }),
			supabase
				.from('subscriptions')
				.select('stripe_subscription_id, product_id, status, current_period_end, created_at')
				.eq('user_id', user.id)
				.eq('status', 'active'),
		]);

		if (error) {
			console.error('my-purchases: Supabase error', error.code, error.message);
			return res.status(500).json({ error: 'Failed to load purchases' });
		}

		const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

		const purchases = (rows || []).map((r) => {
			const items = Array.isArray(r.items) ? r.items : [];
			const flags = getPurchaseFlags(items);
			const createdMs = r.created_at ? new Date(r.created_at).getTime() : Date.now();
			const expiresAt = new Date(createdMs + EXPIRY_MS).toISOString();
			const isExpired = Date.now() > createdMs + EXPIRY_MS;
			return {
				session_id: r.session_id,
				items,
				created_at: r.created_at,
				expiresAt,
				isExpired,
				...flags,
			};
		});

		// Add active subscriptions as synthetic "purchases" for download UI
		const SUBSCRIPTION_FLAGS = { 'vision-x-monthly': { hasVisionX: true } };
		for (const sub of subRows || []) {
			const flags = SUBSCRIPTION_FLAGS[sub.product_id] || {};
			const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
			const isExpired = periodEnd ? Date.now() > periodEnd.getTime() : false;
			purchases.unshift({
				session_id: null,
				subscription_id: sub.stripe_subscription_id,
				items: [{ product_id: sub.product_id, name: 'VISION-X Computer Vision — Monthly', price: 100 }],
				created_at: sub.created_at,
				expiresAt: periodEnd ? periodEnd.toISOString() : null,
				isExpired,
				isSubscription: true,
				...flags,
			});
		}

		res.json({ purchases });
	} catch (err) {
		console.error('my-purchases: Unexpected error', err);
		return res.status(500).json({ error: 'Failed to load purchases' });
	}
};
