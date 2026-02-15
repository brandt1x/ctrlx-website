const path = require('path');
const fs = require('fs');
const { getUserFromRequest, getOwnedPurchase } = require('./auth-helpers');
const { getPurchaseFlags } = require('./items-utils');

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

function hasPurchased(items, script) {
	const cfg = SCRIPT_MAP[script];
	if (!cfg) return false;
	return items.some(
		(i) =>
			(i.name || '').toLowerCase().includes(cfg.nameMatch) ||
			Number(i.price) === cfg.price
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
	const script = req.query.script;

	if (!sessionId || !script) {
		return res.status(400).json({ error: 'Missing session_id or script' });
	}

	const cfg = SCRIPT_MAP[script];
	if (!cfg) {
		return res.status(400).json({ error: 'Invalid script' });
	}

	try {
		const purchase = await getOwnedPurchase(user.id, sessionId);
		if (!purchase) {
			return res.status(403).json({ error: 'Purchase not found or access denied' });
		}

		if (!hasPurchased(purchase.items, script)) {
			return res.status(403).json({ error: 'Script not purchased' });
		}

		const scriptPath = path.join(__dirname, 'scripts', cfg.file);
		if (!fs.existsSync(scriptPath)) {
			return res.status(500).json({ error: 'Script file not found' });
		}

		const content = fs.readFileSync(scriptPath);
		res.setHeader('Content-Type', 'application/octet-stream');
		res.setHeader('Content-Disposition', `attachment; filename="${cfg.filename}"`);
		res.send(content);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: err.message || 'Download failed' });
	}
};
