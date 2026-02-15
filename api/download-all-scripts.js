const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { getUserFromRequest, getOwnedPurchase } = require('./auth-helpers');
const { getPurchaseFlags } = require('./items-utils');

const BUNDLE_FILES = [
	'Cntrl-X-Apex.gpc',
	'Cntrl-X-Arc.gpc',
	'Cntrl-X-COD.gpc',
	'Cntrl-X-Fortnite.gpc',
	'Cntrl-X-Rust.gpc',
	'Cntrl-X-Siege.gpc',
	'Cntrl-X-2K.gpc',
];

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

		const { hasAllBundle } = getPurchaseFlags(purchase.items);
		if (!hasAllBundle) {
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
