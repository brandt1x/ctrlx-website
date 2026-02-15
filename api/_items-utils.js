/**
 * Derive purchase flags from items array (from Stripe metadata or line_items).
 */
function getPurchaseFlags(items) {
	const hasControlX = items.some(
		(i) =>
			(i.name || '').toLowerCase().includes('control+x') ||
			((i.name || '').toLowerCase().includes('control') && Number(i.price) === 75)
	);
	const has2K = items.some(
		(i) =>
			(i.name || '').toLowerCase().includes('2k') ||
			Number(i.price) === 35
	);
	const hasCOD = items.some(
		(i) =>
			(i.name || '').toLowerCase().includes('cod zen') ||
			((i.name || '').toLowerCase().includes('cod') && Number(i.price) === 20)
	);
	const hasApex = items.some(
		(i) =>
			(i.name || '').toLowerCase().includes('apex') ||
			Number(i.price) === 15
	);
	const hasArc = items.some(
		(i) =>
			(i.name || '').toLowerCase().includes('arc zen') ||
			((i.name || '').toLowerCase().includes('arc') && Number(i.price) === 15)
	);
	const hasFortnite = items.some(
		(i) =>
			(i.name || '').toLowerCase().includes('fortnite') ||
			Number(i.price) === 20
	);
	const hasSiege = items.some(
		(i) =>
			(i.name || '').toLowerCase().includes('siege') ||
			Number(i.price) === 20
	);
	const hasRust = items.some(
		(i) =>
			(i.name || '').toLowerCase().includes('rust') ||
			Number(i.price) === 20
	);
	const hasAllBundle = items.some(
		(i) =>
			(i.name || '').toLowerCase().includes('all zen scripts') ||
			(i.name || '').toLowerCase().includes('all scripts') ||
			Number(i.price) === 100
	);
	const hasVisionX = items.some(
		(i) =>
			(i.name || '').toLowerCase().includes('vision-x') ||
			(i.name || '').toLowerCase().includes('vision x') ||
			Number(i.price) === 500
	);

	return {
		hasControlX,
		has2K,
		hasCOD,
		hasApex,
		hasArc,
		hasFortnite,
		hasSiege,
		hasRust,
		hasAllBundle,
		hasVisionX,
	};
}

module.exports = { getPurchaseFlags };
