const { createClient } = require('@supabase/supabase-js');

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
async function hasActiveSubscription(userId, productId) {
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

	return !error && !!data;
}

module.exports = { getUserFromRequest, userOwnsSession, getOwnedPurchase, hasActiveSubscription };
