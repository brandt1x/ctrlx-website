const { getUserFromRequest } = require('./_auth-helpers');
const { getPurchaseFlags } = require('./_items-utils');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const user = await getUserFromRequest(req);
	if (!user) {
		return res.status(401).json({ error: 'Sign in required' });
	}

	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !supabaseServiceKey) {
		return res.status(500).json({ error: 'Server configuration error' });
	}

	const supabase = createClient(supabaseUrl, supabaseServiceKey);
	const { data: rows, error } = await supabase
		.from('purchases')
		.select('session_id, items, created_at')
		.eq('user_id', user.id)
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Failed to fetch purchases:', error);
		return res.status(500).json({ error: 'Failed to load purchases' });
	}

	const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

	const purchases = (rows || []).map((r) => {
		const items = Array.isArray(r.items) ? r.items : [];
		const flags = getPurchaseFlags(items);
		const createdMs = new Date(r.created_at).getTime();
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
};
