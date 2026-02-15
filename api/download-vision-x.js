const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { getUserFromRequest, getOwnedPurchase } = require('./auth-helpers');
const { getPurchaseFlags } = require('./items-utils');

module.exports = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const user = await getUserFromRequest(req);
	if (!user) {
		return res.status(401).json({ error: 'Sign in required' });
	}

	const sessionId = req.query.session_id;
	if (!sessionId) {
		return res.status(400).json({ error: 'Missing session_id' });
	}

	try {
		const purchase = await getOwnedPurchase(user.id, sessionId);
		if (!purchase) {
			return res.status(403).json({ error: 'Purchase not found or access denied' });
		}

		const { hasVisionX } = getPurchaseFlags(purchase.items);
		if (!hasVisionX) {
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
