const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getPurchaseFlags } = require('./_items-utils');
const { checkRateLimit } = require('./_rate-limit');

const SCRIPT_MAP = {
	'control-x': { file: 'CONTROL+X.gpc', filename: 'CONTROL+X.gpc' },
	'2k': { file: 'Cntrl-X-2K.gpc', filename: 'Cntrl-X-2K.gpc' },
	'cod': { file: 'Cntrl-X-COD.gpc', filename: 'Cntrl-X-COD.gpc' },
	'apex': { file: 'Cntrl-X-Apex.gpc', filename: 'Cntrl-X-Apex.gpc' },
	'arc': { file: 'Cntrl-X ARC.gpc', filename: 'Cntrl-X ARC.gpc' },
	'fortnite': { file: 'Cntrl-X-Fortnite.gpc', filename: 'Cntrl-X-Fortnite.gpc' },
	'rust': { file: 'Cntrl-X Rust.gpc', filename: 'Cntrl-X Rust.gpc' },
};

const BUNDLE_FILES = [
	'CONTROL+X.gpc',
	'Cntrl-X-Apex.gpc', 'Cntrl-X ARC.gpc', 'Cntrl-X-COD.gpc',
	'Cntrl-X-Fortnite.gpc', 'Cntrl-X Rust.gpc',
	'Cntrl-X R6 (Attackers).gpc', 'Cntrl-X R6 (Defenders).gpc', 'R6 Read.Me.txt',
	'Cntrl-X-2K.gpc',
];

const EXPIRY_MS = 24 * 60 * 60 * 1000;

module.exports = async (req, res) => {
	if (req.method !== 'GET') {
		return res.status(405).json({ error: 'Method not allowed' });
	}

	const allowed = await checkRateLimit(req, 'download');
	if (!allowed) {
		return res.status(429).json({ error: 'Too many download requests. Please try again later.' });
	}

	const paymentIntentId = req.query.payment_intent;
	if (!paymentIntentId) {
		return res.status(400).json({ error: 'Missing payment_intent' });
	}

	try {
		const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
		if (!paymentIntent || paymentIntent.status !== 'succeeded') {
			return res.status(400).json({ error: 'Payment not completed' });
		}

		const createdMs = paymentIntent.created * 1000;
		if (Date.now() > createdMs + EXPIRY_MS) {
			return res.status(403).json({ error: 'Download expired. Downloads are available for 24 hours after purchase.' });
		}

		let items = [];
		try {
			const parsed = JSON.parse(paymentIntent.metadata?.items || '[]');
			if (Array.isArray(parsed)) {
				items = parsed.map((i) => ({
					product_id: i.product_id || null,
					name: i.name || '',
					price: typeof i.price === 'number' ? i.price : 0,
				}));
			}
		} catch (_) {}

		if (!items.length) {
			return res.status(400).json({ error: 'No items found in purchase' });
		}

		const flags = getPurchaseFlags(items);
		const scriptsDir = path.join(__dirname, 'scripts');
		const archive = archiver('zip', { zlib: { level: 9 } });
		let fileCount = 0;

		if (flags.hasAllBundle) {
			for (const file of BUNDLE_FILES) {
				const fp = path.join(scriptsDir, file);
				if (fs.existsSync(fp)) {
					archive.file(fp, { name: file });
					fileCount++;
				}
			}
		} else {
			for (const [id, cfg] of Object.entries(SCRIPT_MAP)) {
				const flagKey = 'has' + id.charAt(0).toUpperCase() + id.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
				if (id === 'control-x' && flags.hasControlX) {
					const fp = path.join(scriptsDir, cfg.file);
					if (fs.existsSync(fp)) { archive.file(fp, { name: cfg.filename }); fileCount++; }
				} else if (id === '2k' && flags.has2K) {
					const fp = path.join(scriptsDir, cfg.file);
					if (fs.existsSync(fp)) { archive.file(fp, { name: cfg.filename }); fileCount++; }
				} else if (id === 'cod' && flags.hasCOD) {
					const fp = path.join(scriptsDir, cfg.file);
					if (fs.existsSync(fp)) { archive.file(fp, { name: cfg.filename }); fileCount++; }
				} else if (id === 'apex' && flags.hasApex) {
					const fp = path.join(scriptsDir, cfg.file);
					if (fs.existsSync(fp)) { archive.file(fp, { name: cfg.filename }); fileCount++; }
				} else if (id === 'arc' && flags.hasArc) {
					const fp = path.join(scriptsDir, cfg.file);
					if (fs.existsSync(fp)) { archive.file(fp, { name: cfg.filename }); fileCount++; }
				} else if (id === 'fortnite' && flags.hasFortnite) {
					const fp = path.join(scriptsDir, cfg.file);
					if (fs.existsSync(fp)) { archive.file(fp, { name: cfg.filename }); fileCount++; }
				} else if (id === 'rust' && flags.hasRust) {
					const fp = path.join(scriptsDir, cfg.file);
					if (fs.existsSync(fp)) { archive.file(fp, { name: cfg.filename }); fileCount++; }
				}
			}

			if (flags.hasSiege) {
				const siegeFiles = ['R6 Read.Me.txt', 'Cntrl-X R6 (Attackers).gpc', 'Cntrl-X R6 (Defenders).gpc'];
				for (const f of siegeFiles) {
					const fp = path.join(scriptsDir, f);
					if (fs.existsSync(fp)) { archive.file(fp, { name: f }); fileCount++; }
				}
			}
		}

		if (flags.hasVisionX) {
			const visionXDir = path.join(__dirname, '..', 'vision-x-tempo');
			if (fs.existsSync(visionXDir)) { archive.directory(visionXDir, 'Vision-X-Tempo'); fileCount++; }
		}
		if (flags.hasVisionXPlus) {
			const vxpDir = path.join(__dirname, '..', 'vision-x-plus-timing');
			if (fs.existsSync(vxpDir)) { archive.directory(vxpDir, 'Vision-X-Plus-Timing'); fileCount++; }
		}
		if (flags.hasAimX) {
			const aimXDir = path.join(__dirname, '..', 'aim-x');
			if (fs.existsSync(aimXDir)) { archive.directory(aimXDir, 'Aim-X'); fileCount++; }
		}

		if (fileCount === 0) {
			return res.status(400).json({ error: 'No downloadable files found for this purchase' });
		}

		res.setHeader('Content-Type', 'application/zip');
		res.setHeader('Content-Disposition', 'attachment; filename="Cntrl-X-Purchase.zip"');
		archive.pipe(res);
		await archive.finalize();
	} catch (err) {
		console.error('[download-guest] error:', err);
		res.status(500).json({ error: err.message || 'Download failed' });
	}
};
