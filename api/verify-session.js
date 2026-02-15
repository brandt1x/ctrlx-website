const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const sessionId = req.query.session_id;
	if (!sessionId) {
		return res.status(400).json({ error: 'Missing session_id' });
	}

	try {
		const session = await stripe.checkout.sessions.retrieve(sessionId, {
			expand: ['line_items'],
		});

		if (session.payment_status !== 'paid') {
			return res.status(400).json({ error: 'Payment not completed' });
		}

		let items = [];
		if (session.metadata?.items) {
			try {
				items = JSON.parse(session.metadata.items);
			} catch (_) {}
		}
		if (items.length === 0 && session.line_items?.data) {
			for (const li of session.line_items.data) {
				items.push({
					name: li.description || '',
					price: (li.amount_total || 0) / 100,
				});
			}
		}

		const hasControlX = items.some(
			(i) =>
				(i.name || '').toLowerCase().includes('control+x') ||
				((i.name || '').toLowerCase().includes('control') && Number(i.price) === 75)
		);

		const has2K = items.some(
			(i) =>
				(i.name || '').toLowerCase().includes('2k') ||
				Number(i.price) === 35
		);

		const hasCOD = items.some(
			(i) =>
				(i.name || '').toLowerCase().includes('cod zen') ||
				((i.name || '').toLowerCase().includes('cod') && Number(i.price) === 20)
		);
		const hasApex = items.some(
			(i) =>
				(i.name || '').toLowerCase().includes('apex') ||
				Number(i.price) === 15
		);
		const hasArc = items.some(
			(i) =>
				(i.name || '').toLowerCase().includes('arc zen') ||
				((i.name || '').toLowerCase().includes('arc') && Number(i.price) === 15)
		);
		const hasFortnite = items.some(
			(i) =>
				(i.name || '').toLowerCase().includes('fortnite') ||
				Number(i.price) === 20
		);
		const hasSiege = items.some(
			(i) =>
				(i.name || '').toLowerCase().includes('siege') ||
				Number(i.price) === 20
		);
		const hasRust = items.some(
			(i) =>
				(i.name || '').toLowerCase().includes('rust') ||
				Number(i.price) === 20
		);
		const hasAllBundle = items.some(
			(i) =>
				(i.name || '').toLowerCase().includes('all zen scripts') ||
				(i.name || '').toLowerCase().includes('all scripts') ||
				Number(i.price) === 100
		);

		const hasVisionX = items.some(
			(i) =>
				(i.name || '').toLowerCase().includes('vision-x') ||
				(i.name || '').toLowerCase().includes('vision x') ||
				Number(i.price) === 500
		);

		res.json({
			paid: true,
			items,
			hasControlX,
			has2K,
			hasCOD,
			hasApex,
			hasArc,
			hasFortnite,
			hasSiege,
			hasRust,
			hasAllBundle,
			hasVisionX,
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: err.message });
	}
};
