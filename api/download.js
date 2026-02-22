const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { getUserFromRequest, getOwnedPurchase } = require('./_auth-helpers');
const { getPurchaseFlags } = require('./_items-utils');
const { checkRateLimit } = require('./_rate-limit');

const SCRIPT_MAP = {
	'control-x': { file: 'CONTROL+X.gpc', filename: 'CONTROL+X.gpc', price: 75, nameMatch: 'control+x' },
	'2k': { file: 'Cntrl-X-2K.gpc', filename: 'Cntrl-X-2K.gpc', price: 35, nameMatch: '2k' },
	'cod': { file: 'Cntrl-X-COD.gpc', filename: 'Cntrl-X-COD.gpc', price: 20, nameMatch: 'cod' },
	'apex': { file: 'Cntrl-X-Apex.gpc', filename: 'Cntrl-X-Apex.gpc', price: 15, nameMatch: 'apex' },
	'arc': { file: 'Cntrl-X ARC.gpc', filename: 'Cntrl-X ARC.gpc', price: 15, nameMatch: 'arc' },
	'fortnite': { file: 'Cntrl-X-Fortnite.gpc', filename: 'Cntrl-X-Fortnite.gpc', price: 20, nameMatch: 'fortnite' },
	'rust': { file: 'Cntrl-X Rust.gpc', filename: 'Cntrl-X Rust.gpc', price: 20, nameMatch: 'rust' },
};

// Zen scripts only – excludes CONTROL+X and VISION-X (ultimate products). Includes base 2K script.
const BUNDLE_FILES = [
	'Cntrl-X-Apex.gpc', 'Cntrl-X ARC.gpc', 'Cntrl-X-COD.gpc',
	'Cntrl-X-Fortnite.gpc', 'Cntrl-X Rust.gpc',
	'Cntrl-X R6 (Attackers).gpc', 'Cntrl-X R6 (Defenders).gpc', 'R6 Read.Me.txt',
	'Cntrl-X-2K.gpc',
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

	const allowed = await checkRateLimit(req, 'download');
	if (!allowed) {
		return res.status(429).json({ error: 'Too many download requests. Please try again later.' });
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

	const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

	try {
		const purchase = await getOwnedPurchase(user.id, sessionId);
		if (!purchase) {
			return res.status(403).json({ error: 'Purchase not found or access denied' });
		}

		// Enforce 24-hour download window
		if (purchase.created_at) {
			const createdMs = new Date(purchase.created_at).getTime();
			if (Date.now() > createdMs + EXPIRY_MS) {
				return res.status(403).json({ error: 'Download expired. Downloads are available for 24 hours after purchase.' });
			}
		}

		const flags = getPurchaseFlags(purchase.items);

		if (type === 'siege' || (type === 'script' && script === 'siege')) {
			if (!flags.hasSiege) return res.status(403).json({ error: 'Siege not purchased' });
			const scriptsDir = path.join(__dirname, 'scripts');
			const siegeFiles = [
				{ src: 'R6 Read.Me.txt', name: 'R6 Read.Me.txt' },
				{ src: 'Cntrl-X R6 (Attackers).gpc', name: 'Cntrl-X R6 (Attackers).gpc' },
				{ src: 'Cntrl-X R6 (Defenders).gpc', name: 'Cntrl-X R6 (Defenders).gpc' },
			];
			for (const f of siegeFiles) {
				if (!fs.existsSync(path.join(scriptsDir, f.src))) {
					return res.status(500).json({ error: `Script file not found: ${f.src}` });
				}
			}
			res.setHeader('Content-Type', 'application/zip');
			res.setHeader('Content-Disposition', 'attachment; filename="Cntrl-X-R6-Siege.zip"');
			const archive = archiver('zip', { zlib: { level: 9 } });
			archive.pipe(res);
			for (const f of siegeFiles) {
				archive.file(path.join(scriptsDir, f.src), { name: f.name });
			}
			await archive.finalize();
			return;
		}

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

		if (type === 'vision-x-plus') {
			if (!flags.hasVisionXPlus) return res.status(403).json({ error: 'Vision+X not purchased' });
			const visionXPlusDir = path.join(__dirname, '..', 'vision-x-plus-timing');
			if (!fs.existsSync(visionXPlusDir)) return res.status(500).json({ error: 'Vision+X package not found' });
			res.setHeader('Content-Type', 'application/zip');
			res.setHeader('Content-Disposition', 'attachment; filename="Vision-X-Plus-Timing.zip"');
			const archive = archiver('zip', { zlib: { level: 9 } });
			archive.pipe(res);
			archive.directory(visionXPlusDir, 'Vision-X-Plus-Timing');
			await archive.finalize();
			return;
		}

		if (type === 'aim-x') {
			if (!flags.hasAimX) return res.status(403).json({ error: 'Aim-X not purchased' });
			const aimXDir = path.join(__dirname, '..', 'aim-x');
			if (!fs.existsSync(aimXDir)) return res.status(500).json({ error: 'Aim-X package not found' });
			res.setHeader('Content-Type', 'application/zip');
			res.setHeader('Content-Disposition', 'attachment; filename="Aim-X.zip"');
			const archive = archiver('zip', { zlib: { level: 9 } });
			archive.pipe(res);
			archive.directory(aimXDir, 'Aim-X');
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

		return res.status(400).json({ error: 'Invalid type. Use type=vision-x|vision-x-plus|aim-x|siege|all-scripts|script' });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: err.message || 'Download failed' });
	}
};
