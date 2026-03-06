const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getPurchaseFlags } = require('./_items-utils');
const { checkRateLimit } = require('./_rate-limit');
const { getOrCreateLicenseKey, sendLicenseEmail } = require('./_license');

require('archiver-zip-encrypted');

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

const APP_PRODUCT_IDS = new Set(['vision-x', 'vision-x-plus', 'aim-x', 'vision-setup']);

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

		const hasScripts = items.some((i) => !APP_PRODUCT_IDS.has((i.product_id || '').toLowerCase()));
		const hasApps = flags.hasVisionX || flags.hasVisionXPlus || flags.hasAimX;

		let licenseKey = null;
		if (hasScripts) {
			const customerEmail = paymentIntent.metadata?.customer_email || paymentIntent.receipt_email || '';
			const productIds = items.map((i) => i.product_id).filter(Boolean);
			const productNames = items.map((i) => i.name).filter(Boolean);
			licenseKey = await getOrCreateLicenseKey({
				paymentIntentId: paymentIntent.id,
				userId: paymentIntent.metadata?.user_id || null,
				email: customerEmail,
				productIds,
			});
			if (licenseKey && customerEmail) {
				await sendLicenseEmail(customerEmail, licenseKey, productNames);
			}
		}

		const archive = licenseKey
			? archiver.create('zip-encrypted', { zlib: { level: 9 }, encryptionMethod: 'aes256', password: licenseKey })
			: archiver('zip', { zlib: { level: 9 } });
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
			if (flags.hasControlX) {
				const fp = path.join(scriptsDir, SCRIPT_MAP['control-x'].file);
				if (fs.existsSync(fp)) { archive.file(fp, { name: SCRIPT_MAP['control-x'].filename }); fileCount++; }
			}
			if (flags.has2K) {
				const fp = path.join(scriptsDir, SCRIPT_MAP['2k'].file);
				if (fs.existsSync(fp)) { archive.file(fp, { name: SCRIPT_MAP['2k'].filename }); fileCount++; }
			}
			if (flags.hasCOD) {
				const fp = path.join(scriptsDir, SCRIPT_MAP['cod'].file);
				if (fs.existsSync(fp)) { archive.file(fp, { name: SCRIPT_MAP['cod'].filename }); fileCount++; }
			}
			if (flags.hasApex) {
				const fp = path.join(scriptsDir, SCRIPT_MAP['apex'].file);
				if (fs.existsSync(fp)) { archive.file(fp, { name: SCRIPT_MAP['apex'].filename }); fileCount++; }
			}
			if (flags.hasArc) {
				const fp = path.join(scriptsDir, SCRIPT_MAP['arc'].file);
				if (fs.existsSync(fp)) { archive.file(fp, { name: SCRIPT_MAP['arc'].filename }); fileCount++; }
			}
			if (flags.hasFortnite) {
				const fp = path.join(scriptsDir, SCRIPT_MAP['fortnite'].file);
				if (fs.existsSync(fp)) { archive.file(fp, { name: SCRIPT_MAP['fortnite'].filename }); fileCount++; }
			}
			if (flags.hasRust) {
				const fp = path.join(scriptsDir, SCRIPT_MAP['rust'].file);
				if (fs.existsSync(fp)) { archive.file(fp, { name: SCRIPT_MAP['rust'].filename }); fileCount++; }
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
