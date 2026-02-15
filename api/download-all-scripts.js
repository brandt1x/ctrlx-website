const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

const BUNDLE_FILES = [
	'Cntrl-X-Apex.gpc',
	'Cntrl-X-Arc.gpc',
	'Cntrl-X-COD.gpc',
	'Cntrl-X-Fortnite.gpc',
	'Cntrl-X-Rust.gpc',
	'Cntrl-X-Siege.gpc',
	'Cntrl-X-2K.gpc',
];

function hasAllBundle(items) {
	return items.some(
		(i) =>
			(i.name || '').toLowerCase().includes('all zen scripts') ||
			(i.name || '').toLowerCase().includes('all scripts') ||
			Number(i.price) === 100
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

		if (!hasAllBundle(items)) {
			return res.status(403).json({ error: 'Bundle not purchased' });
		}

		const scriptsDir = path.join(__dirname, 'scripts');
		for (const file of BUNDLE_FILES) {
			const filePath = path.join(scriptsDir, file);
			if (!fs.existsSync(filePath)) {
				return res.status(500).json({ error: `Script file not found: ${file}` });
			}
		}

		res.setHeader('Content-Type', 'application/zip');
		res.setHeader('Content-Disposition', 'attachment; filename="Cntrl-X-All-Scripts.zip"');

		const archive = archiver('zip', { zlib: { level: 9 } });
		archive.pipe(res);

		for (const file of BUNDLE_FILES) {
			archive.file(path.join(scriptsDir, file), { name: file });
		}

		await archive.finalize();
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: err.message || 'Download failed' });
	}
};
