/**
 * Server-side product catalog. Prices and entitlements are derived from here.
 * Never trust client-supplied prices.
 */
const PRODUCT_CATALOG = {
	'control-x': { name: 'CONTROL+X Zen Script', price: 65 },
	'2k': { name: '2K Zen Script', price: 35 },
	'cod': { name: 'COD Zen Script', price: 20 },
	'apex': { name: 'Apex Zen Script', price: 15 },
	'arc': { name: 'ARC Zen Script', price: 15 },
	'fortnite': { name: 'Fortnite Zen Script', price: 20 },
	'siege': { name: 'Siege Zen Script', price: 20 },
	'rust': { name: 'Rust Zen Script', price: 20 },
	'all-scripts': { name: 'All Zen Scripts Bundle', price: 135 },
	'vision-x': { name: 'VISION-X Computer Vision', price: 450 },
	'vision-x-monthly': { name: 'VISION-X Computer Vision — Monthly', price: 100, recurring: 'month' },
	'vision-x-plus': { name: 'VISION+X Computer Vision', price: 750 },
	'aim-x': { name: 'AIM-X Aim Engine', price: 275 },
	'vision-setup': { name: 'CTRL-X All Services Setup', price: 25 },
	'jaguars-boost': { name: 'Jaguars Account Boosting — Starter II-Vet II', price: 400 },

	// PC Cheats — Monthly (recurring subscriptions)
	'cheat-valorant-monthly': { name: 'Valorant Cheat — Monthly', price: 79, recurring: 'month' },
	'cheat-rainbow-six-siege-monthly': { name: 'Rainbow Six Siege Cheat — Monthly', price: 79, recurring: 'month' },
	'cheat-fortnite-monthly': { name: 'Fortnite Cheat — Monthly', price: 79, recurring: 'month' },
	'cheat-apex-legends-monthly': { name: 'Apex Legends Cheat — Monthly', price: 79, recurring: 'month' },
	'cheat-rust-monthly': { name: 'Rust Cheat — Monthly', price: 99, recurring: 'month' },
	'cheat-cod-black-ops-6-monthly': { name: 'COD: Black Ops 6 Cheat — Monthly', price: 99, recurring: 'month' },
	'cheat-arc-raiders-monthly': { name: 'Arc Raiders Cheat — Monthly', price: 79, recurring: 'month' },
	'cheat-marvel-rivals-monthly': { name: 'Marvel Rivals Cheat — Monthly', price: 79, recurring: 'month' },
	'cheat-pubg-monthly': { name: 'PUBG Cheat — Monthly', price: 79, recurring: 'month' },
	'cheat-hardware-spoofer-monthly': { name: 'Hardware Spoofer — Monthly', price: 59, recurring: 'month' },

	// PC Cheats — Lifetime (one-time purchases)
	'cheat-valorant-lifetime': { name: 'Valorant Cheat — Lifetime', price: 599 },
	'cheat-rainbow-six-siege-lifetime': { name: 'Rainbow Six Siege Cheat — Lifetime', price: 599 },
	'cheat-fortnite-lifetime': { name: 'Fortnite Cheat — Lifetime', price: 599 },
	'cheat-apex-legends-lifetime': { name: 'Apex Legends Cheat — Lifetime', price: 599 },
	'cheat-rust-lifetime': { name: 'Rust Cheat — Lifetime', price: 799 },
	'cheat-cod-black-ops-6-lifetime': { name: 'COD: Black Ops 6 Cheat — Lifetime', price: 799 },
	'cheat-arc-raiders-lifetime': { name: 'Arc Raiders Cheat — Lifetime', price: 599 },
	'cheat-marvel-rivals-lifetime': { name: 'Marvel Rivals Cheat — Lifetime', price: 599 },
	'cheat-pubg-lifetime': { name: 'PUBG Cheat — Lifetime', price: 599 },
	'cheat-hardware-spoofer-lifetime': { name: 'Hardware Spoofer — Lifetime', price: 449 },
};

function getProduct(productId) {
	return productId && PRODUCT_CATALOG[productId];
}

function validateAndBuildLineItems(productIds) {
	if (!Array.isArray(productIds) || productIds.length === 0) return null;
	const lineItems = [];
	const items = [];
	for (const id of productIds) {
		const product = getProduct(id);
		if (!product) return null;
		if (product.recurring) return null; // Recurring products use subscription checkout, not cart
		lineItems.push({
			price_data: {
				currency: 'usd',
				product_data: {
					name: product.name,
					metadata: { product_id: id },
				},
				unit_amount: Math.round(product.price * 100),
			},
			quantity: 1,
		});
		items.push({ product_id: id, name: product.name, price: product.price });
	}
	return { lineItems, items };
}

module.exports = { PRODUCT_CATALOG, getProduct, validateAndBuildLineItems };
