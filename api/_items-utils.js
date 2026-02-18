/**
 * Product ID to entitlement mapping. Prefer product_id over name/price when available.
 */
const PRODUCT_TO_FLAGS = {
	'control-x': ['hasControlX'],
	'2k': ['has2K'],
	cod: ['hasCOD'],
	apex: ['hasApex'],
	arc: ['hasArc'],
	fortnite: ['hasFortnite'],
	siege: ['hasSiege'],
	rust: ['hasRust'],
	'all-scripts': ['hasAllBundle'],
	'vision-x': ['hasVisionX'],
};

/**
 * Derive purchase flags from items array (from Stripe line_items).
 * Uses product_id when available; falls back to name/price matching for legacy data.
 */
function getPurchaseFlags(items) {
	const flags = {
		hasControlX: false,
		has2K: false,
		hasCOD: false,
		hasApex: false,
		hasArc: false,
		hasFortnite: false,
		hasSiege: false,
		hasRust: false,
		hasAllBundle: false,
		hasVisionX: false,
	};

	for (const i of items) {
		const productId = (i.product_id || '').toLowerCase();
		if (productId && PRODUCT_TO_FLAGS[productId]) {
			for (const key of PRODUCT_TO_FLAGS[productId]) {
				flags[key] = true;
			}
			continue;
		}
		const name = (i.name || '').toLowerCase();
		const price = Number(i.price);
		if (name.includes('control+x') || (name.includes('control') && price === 75)) flags.hasControlX = true;
		if (name.includes('2k') || price === 35) flags.has2K = true;
		if (name.includes('cod zen') || (name.includes('cod') && price === 20)) flags.hasCOD = true;
		if (name.includes('apex') || price === 15) flags.hasApex = true;
		if (name.includes('arc zen') || (name.includes('arc') && price === 15)) flags.hasArc = true;
		if (name.includes('fortnite') || price === 20) flags.hasFortnite = true;
		if (name.includes('siege') || price === 20) flags.hasSiege = true;
		if (name.includes('rust') || price === 20) flags.hasRust = true;
		if (name.includes('all zen scripts') || name.includes('all scripts') || price === 100) flags.hasAllBundle = true;
		if (name.includes('vision-x') || name.includes('vision x') || price === 500) flags.hasVisionX = true;
	}

	return flags;
}

module.exports = { getPurchaseFlags };
