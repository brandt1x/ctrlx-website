const { getUserFromRequest } = require('./_auth-helpers');
const { getPurchaseFlags } = require('./_items-utils');
const { createClient } = require('@supabase/supabase-js');

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
		if (!supabaseUrl || !supabaseServiceKey) {
			console.error('my-purchases: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
			return res.status(500).json({ error: 'Server configuration error' });
		}

		const supabase = createClient(supabaseUrl, supabaseServiceKey);
		const { data: rows, error } = await supabase
			.from('purchases')
			.select('session_id, items, created_at')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false });

		if (error) {
			console.error('my-purchases: Supabase error', error.code, error.message);
			return res.status(500).json({
				error: 'Failed to load purchases',
				reason: 'SUPABASE_QUERY',
				code: error.code || null,
				detail: error.message || null,
			});
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

		res.json({ purchases });
	} catch (err) {
		console.error('my-purchases: Unexpected error', err);
		return res.status(500).json({
			error: 'Failed to load purchases',
			reason: 'UNEXPECTED',
			detail: err?.message || null,
		});
	}
};
