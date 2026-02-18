const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { getUserFromRequest } = require('./_auth-helpers');

module.exports = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const user = await getUserFromRequest(req);
	if (!user) {
		return res.status(401).json({ error: 'Sign in required' });
	}

	const sessionId = req.body?.session_id || null;
	if (!sessionId || typeof sessionId !== 'string') {
		return res.status(400).json({ error: 'Missing session_id' });
	}

	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !supabaseServiceKey) {
		return res.status(500).json({ error: 'Server configuration error' });
	}

	const supabase = createClient(supabaseUrl, supabaseServiceKey);

	const { data: existing } = await supabase
		.from('purchases')
		.select('id')
		.eq('user_id', user.id)
		.eq('session_id', sessionId)
		.maybeSingle();

	if (existing) {
		return res.json({ recovered: false, reason: 'already_exists' });
	}

	let session;
	try {
		session = await stripe.checkout.sessions.retrieve(sessionId, {
			expand: ['line_items', 'line_items.data.price.product'],
		});
	} catch (err) {
		return res.status(404).json({ error: 'Checkout session not found' });
	}

	if (session.payment_status !== 'paid') {
		return res.status(400).json({ error: 'Checkout session not paid' });
	}

	const metadataUserId = session.metadata?.user_id || null;
	if (!metadataUserId || metadataUserId !== user.id) {
		return res.status(403).json({ error: 'Session does not belong to current user' });
	}

	let items = [];
	const metadataItems = session.metadata?.items;
	if (metadataItems) {
		try {
			const parsed = JSON.parse(metadataItems);
			if (Array.isArray(parsed) && parsed.length > 0) {
				items = parsed.map((i) => ({
					product_id: i.product_id || null,
					name: i.name || '',
					price: typeof i.price === 'number' ? i.price : 0,
				}));
			}
		} catch (_) {}
	}

	if (items.length === 0) {
		const lineData = session.line_items?.data || [];
		for (const li of lineData) {
			const product = li.price?.product;
			const productId = typeof product === 'object' && product?.metadata?.product_id
				? product.metadata.product_id
				: null;
			const name = li.description || (typeof product === 'object' ? product?.name : '') || '';
			const price = (li.amount_total || 0) / 100;
			items.push(productId ? { product_id: productId, name, price } : { name, price });
		}
	}

	const { error: insertError } = await supabase.from('purchases').insert({
		user_id: user.id,
		session_id: session.id,
		items,
	});

	if (insertError && insertError.code !== '23505') {
		return res.status(500).json({ error: 'Failed to recover purchase', code: insertError.code || null });
	}

	// #region agent log
	fetch('http://127.0.0.1:7247/ingest/14e09fd4-ef14-4c17-a7af-1afd0c9a1266',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/recover-purchase.js:inserted',message:'recovered purchase from stripe session',data:{sessionIdPrefix:session.id?.slice(0,20),itemCount:items.length},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
	// #endregion

	return res.json({ recovered: true, itemCount: items.length });
};
