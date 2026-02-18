/**
 * Diagnostic endpoint to debug "purchases not showing" issues.
 * GET /api/purchase-debug - requires Authorization: Bearer <token>
 * GET /api/purchase-debug?session_id=cs_xxx - check if specific session was recorded
 * Returns: { ok, authenticated, purchaseCount, userId?, sessionFound?, error? }
 */
const { getUserFromRequest } = require('./_auth-helpers');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const user = await getUserFromRequest(req);
	if (!user) {
		return res.json({ ok: true, authenticated: false, purchaseCount: 0, error: 'Not signed in' });
	}

	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !supabaseServiceKey) {
		return res.json({ ok: false, authenticated: true, userId: user.id, error: 'Supabase not configured' });
	}

	const supabase = createClient(supabaseUrl, supabaseServiceKey);
	const { data: rows, error } = await supabase
		.from('purchases')
		.select('id, session_id')
		.eq('user_id', user.id);

	if (error) {
		return res.json({
			ok: false,
			authenticated: true,
			userId: user.id,
			purchaseCount: 0,
			error: 'DB error: ' + (error.message || error.code),
		});
	}

	const purchaseCount = (rows || []).length;
	const sessionId = (req.query && req.query.session_id) || null;
	let sessionFound = null;
	if (sessionId && rows) {
		sessionFound = rows.some((r) => r.session_id === sessionId);
	}

	res.json({
		ok: true,
		authenticated: true,
		userId: user.id,
		purchaseCount,
		...(sessionId != null && { sessionFound }),
	});
};
