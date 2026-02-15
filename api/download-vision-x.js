const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

function hasVisionX(items) {
	return items.some(
		(i) =>
			(i.name || '').toLowerCase().includes('vision-x') ||
			(i.name || '').toLowerCase().includes('vision x') ||
			Number(i.price) === 500
	);
}

module.exports = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const sessionId = req.query.session_id;
	if (!sessionId) {
		return res.status(400).json({ error: 'Missing session_id' });
	}

	try {
		const session = await stripe.checkout.sessions.retrieve(sessionId);

		if (session.payment_status !== 'paid') {
			return res.status(403).json({ error: 'Payment not completed' });
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
					name: li.description || li.price?.product?.name || '',
					price: (li.amount_total || 0) / 100,
				});
			}
		}

		if (!hasVisionX(items)) {
			return res.status(403).json({ error: 'Vision-X not purchased' });
		}

		const visionXDir = path.join(__dirname, 'vision-x-tempo');
		if (!fs.existsSync(visionXDir)) {
			return res.status(500).json({ error: 'Vision-X package not found' });
		}

		res.setHeader('Content-Type', 'application/zip');
		res.setHeader('Content-Disposition', 'attachment; filename="Vision-X-Tempo.zip"');

		const archive = archiver('zip', { zlib: { level: 9 } });
		archive.pipe(res);
		archive.directory(visionXDir, 'Vision-X-Tempo');
		await archive.finalize();
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: err.message || 'Download failed' });
	}
};
