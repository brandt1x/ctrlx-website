/**
 * Server-side product catalog. Prices and entitlements are derived from here.
 * Never trust client-supplied prices.
 */
const PRODUCT_CATALOG = {
	'control-x': { name: 'CONTROL+X Zen Script', price: 75 },
	'2k': { name: '2K Zen Script', price: 35 },
	'cod': { name: 'COD Zen Script', price: 20 },
	'apex': { name: 'Apex Zen Script', price: 15 },
	'arc': { name: 'ARC Zen Script', price: 25 },
	'fortnite': { name: 'Fortnite Zen Script', price: 20 },
	'siege': { name: 'Siege Zen Script', price: 20 },
	'rust': { name: 'Rust Zen Script', price: 20 },
	'all-scripts': { name: 'All Zen Scripts Bundle', price: 100 },
	'vision-x': { name: 'VISION-X Computer Vision', price: 500 },
	'vision-setup': { name: 'CTRL-X Vision Setup', price: 25 },
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
