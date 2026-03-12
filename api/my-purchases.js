const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getUserFromRequest } = require('../lib/auth-helpers');
const { getPurchaseFlags } = require('../lib/items-utils');
const { createClient } = require('@supabase/supabase-js');

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

async function syncSubscriptionsFromStripe(userId, userEmail) {
	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !supabaseServiceKey) return;
	const email = (userEmail || '').trim().toLowerCase();
	if (!email) return;
	try {
		const supabase = createClient(supabaseUrl, supabaseServiceKey);
		const customers = await stripe.customers.list({ email, limit: 10 });
		const seenSubscriptions = new Set();
		for (const customer of customers.data || []) {
			const subs = await stripe.subscriptions.list({
				customer: customer.id,
				status: 'all',
				limit: 100,
				expand: ['data.latest_invoice.payment_intent'],
			});
			for (const sub of subs.data || []) {
				if (!sub?.id || seenSubscriptions.has(sub.id)) continue;
				seenSubscriptions.add(sub.id);

				const paymentIntentStatus = sub.latest_invoice?.payment_intent?.status || '';
				const shouldGrantAccess =
					sub.status === 'active' ||
					sub.status === 'trialing' ||
					sub.status === 'past_due' ||
					paymentIntentStatus === 'succeeded';
				if (!shouldGrantAccess) continue;

				const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
				const productId = sub.metadata?.product_id || 'vision-x-monthly';
				await persistSubscriptionRecord(supabase, {
					user_id: userId,
					stripe_subscription_id: sub.id,
					product_id: productId,
					status: 'active',
					current_period_end: periodEnd,
					updated_at: new Date().toISOString(),
				});
			}
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
		const [{ data: rows, error }, subQuery] = await Promise.all([
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
		let subRows = subQuery?.data || [];

		if (error) {
			console.error('my-purchases: Supabase error', error.code, error.message);
			return res.status(500).json({ error: 'Failed to load purchases' });
		}

		if ((!subRows || subRows.length === 0) && user.email) {
			await syncSubscriptionsFromStripe(user.id, user.email);
			const { data: refreshedSubs } = await supabase
				.from('subscriptions')
				.select('stripe_subscription_id, product_id, status, current_period_end, created_at')
				.eq('user_id', user.id)
				.eq('status', 'active');
			subRows = refreshedSubs || [];
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
