const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { getUserFromRequest, getOwnedPurchase } = require('./_auth-helpers');
const { getPurchaseFlags } = require('./_items-utils');

const SCRIPT_MAP = {
	'control-x': { file: 'CONTROL+X.gpc', filename: 'CONTROL+X.gpc', price: 75, nameMatch: 'control+x' },
	'2k': { file: 'Cntrl-X-2K.gpc', filename: 'Cntrl-X-2K.gpc', price: 35, nameMatch: '2k' },
	'cod': { file: 'Cntrl-X-COD.gpc', filename: 'Cntrl-X-COD.gpc', price: 20, nameMatch: 'cod' },
	'apex': { file: 'Cntrl-X-Apex.gpc', filename: 'Cntrl-X-Apex.gpc', price: 15, nameMatch: 'apex' },
	'arc': { file: 'Cntrl-X-Arc.gpc', filename: 'Cntrl-X-Arc.gpc', price: 15, nameMatch: 'arc' },
	'fortnite': { file: 'Cntrl-X-Fortnite.gpc', filename: 'Cntrl-X-Fortnite.gpc', price: 20, nameMatch: 'fortnite' },
	'siege': { file: 'Cntrl-X-Siege.gpc', filename: 'Cntrl-X-Siege.gpc', price: 20, nameMatch: 'siege' },
	'rust': { file: 'Cntrl-X-Rust.gpc', filename: 'Cntrl-X-Rust.gpc', price: 20, nameMatch: 'rust' },
};

const BUNDLE_FILES = [
	'Cntrl-X-Apex.gpc', 'Cntrl-X-Arc.gpc', 'Cntrl-X-COD.gpc',
	'Cntrl-X-Fortnite.gpc', 'Cntrl-X-Rust.gpc', 'Cntrl-X-Siege.gpc', 'Cntrl-X-2K.gpc',
];

function hasPurchased(items, script) {
	const cfg = SCRIPT_MAP[script];
	if (!cfg) return false;
	return items.some(
		(i) => (i.name || '').toLowerCase().includes(cfg.nameMatch) || Number(i.price) === cfg.price
	);
}

module.exports = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const user = await getUserFromRequest(req);
	if (!user) {
		return res.status(401).json({ error: 'Sign in required' });
	}

	const sessionId = req.query.session_id;
	const type = req.query.type || req.query.t;
	const script = req.query.script;

	if (!sessionId || !type) {
		return res.status(400).json({ error: 'Missing session_id or type' });
	}

	try {
		const purchase = await getOwnedPurchase(user.id, sessionId);
		if (!purchase) {
			return res.status(403).json({ error: 'Purchase not found or access denied' });
		}

		const flags = getPurchaseFlags(purchase.items);

		if (type === 'vision-x') {
			if (!flags.hasVisionX) return res.status(403).json({ error: 'Vision-X not purchased' });
			const visionXDir = path.join(__dirname, '..', 'vision-x-tempo');
			if (!fs.existsSync(visionXDir)) return res.status(500).json({ error: 'Vision-X package not found' });
			res.setHeader('Content-Type', 'application/zip');
			res.setHeader('Content-Disposition', 'attachment; filename="Vision-X-Tempo.zip"');
			const archive = archiver('zip', { zlib: { level: 9 } });
			archive.pipe(res);
			archive.directory(visionXDir, 'Vision-X-Tempo');
			await archive.finalize();
			return;
		}

		if (type === 'all-scripts') {
			if (!flags.hasAllBundle) return res.status(403).json({ error: 'Bundle not purchased' });
			const scriptsDir = path.join(__dirname, 'scripts');
			for (const file of BUNDLE_FILES) {
				if (!fs.existsSync(path.join(scriptsDir, file))) {
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
			return;
		}

		if (type === 'script') {
			if (!script) return res.status(400).json({ error: 'Missing script' });
			const cfg = SCRIPT_MAP[script];
			if (!cfg) return res.status(400).json({ error: 'Invalid script' });
			if (!hasPurchased(purchase.items, script)) return res.status(403).json({ error: 'Script not purchased' });
			const scriptPath = path.join(__dirname, 'scripts', cfg.file);
			if (!fs.existsSync(scriptPath)) return res.status(500).json({ error: 'Script file not found' });
			const content = fs.readFileSync(scriptPath);
			res.setHeader('Content-Type', 'application/octet-stream');
			res.setHeader('Content-Disposition', `attachment; filename="${cfg.filename}"`);
			res.send(content);
			return;
		}

		return res.status(400).json({ error: 'Invalid type. Use type=vision-x|all-scripts|script' });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: err.message || 'Download failed' });
	}
};
