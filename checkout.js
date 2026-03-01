document.addEventListener('DOMContentLoaded', () => {
	const yearEl = document.getElementById('year');
	if (yearEl) yearEl.textContent = new Date().getFullYear();

	const form = document.getElementById('checkout-form');
	const payButton = document.getElementById('pay-button');
	const msgEl = document.getElementById('checkout-message');
	const itemsEl = document.getElementById('checkout-items');
	const subtotalEl = document.getElementById('checkout-subtotal');
	const promoEl = document.getElementById('checkout-promo');
	const totalEl = document.getElementById('checkout-total');

	const CART_KEY = 'siteCart';
	const PROMO_KEY = 'siteCartPromo';

	let stripe = null;
	let elements = null;
	let authToken = null;

	function setMessage(text, isError) {
		if (!msgEl) return;
		msgEl.textContent = text || '';
		msgEl.classList.toggle('error', !!isError);
	}

	function getCartItems() {
		try {
			const raw = localStorage.getItem(CART_KEY);
			const parsed = JSON.parse(raw || '[]');
			return Array.isArray(parsed) ? parsed : [];
		} catch (_) {
			return [];
		}
	}

	function getPromoCode() {
		try {
			return (sessionStorage.getItem(PROMO_KEY) || '').trim().toUpperCase() || null;
		} catch (_) {
			return null;
		}
	}

	function renderSummary(items, promoCode) {
		const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
		const promoActive = promoCode === '2000!';
		const total = promoActive ? subtotal * 0.5 : subtotal;
		if (itemsEl) {
			itemsEl.innerHTML = items.map((item) => {
				const price = Number(item.price) || 0;
				return `<li><span>${item.name || 'Item'}</span><strong>$${price % 1 === 0 ? price : price.toFixed(2)}</strong></li>`;
			}).join('');
		}
		if (subtotalEl) subtotalEl.textContent = `$${subtotal % 1 === 0 ? subtotal : subtotal.toFixed(2)}`;
		if (promoEl) promoEl.textContent = promoActive ? '2000! (50% off)' : 'None';
		if (totalEl) totalEl.textContent = `$${total % 1 === 0 ? total : total.toFixed(2)}`;
	}

	async function getAuthToken() {
		if (window.__supabaseClient) {
			const { data: { session } } = await window.__supabaseClient.auth.getSession();
			return session?.access_token || null;
		}
		if (!window.supabase && !window.supabaseJs) {
			await new Promise((resolve, reject) => {
				const s = document.createElement('script');
				s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
				s.async = true;
				s.onload = resolve;
				s.onerror = reject;
				document.head.appendChild(s);
			});
		}
		const cfgRes = await fetch('/api/supabase-config');
		const cfg = await cfgRes.json();
		if (!cfg?.url || !cfg?.anonKey) return null;
		const lib = window.supabase || window.supabaseJs;
		const createClient = lib?.createClient || lib?.default?.createClient;
		if (!createClient) return null;
		const client = createClient(cfg.url, cfg.anonKey);
		window.__supabaseClient = client;
		const { data: { session } } = await client.auth.getSession();
		return session?.access_token || null;
	}

	async function finalizePayment(paymentIntentId) {
		const res = await fetch('/api/complete-payment-intent', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Bearer ' + authToken,
			},
			body: JSON.stringify({ payment_intent_id: paymentIntentId }),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error || 'Payment completed, but order sync failed.');
		try {
			localStorage.removeItem(CART_KEY);
			sessionStorage.removeItem(PROMO_KEY);
		} catch (_) {}
		window.location.href = `/account.html?success=1&session_id=${encodeURIComponent(paymentIntentId)}`;
	}

	async function initializeCheckout() {
		const items = getCartItems().filter((i) => i && i.productId);
		const productIds = items.map((i) => i.productId);
		const promoCode = getPromoCode();
		renderSummary(items, promoCode);
		if (!items.length) {
			setMessage('Your cart is empty. Add products before checkout.', true);
			if (payButton) payButton.disabled = true;
			return;
		}

		authToken = await getAuthToken();
		if (!authToken) {
			window.location.href = '/account.html?returnTo=checkout';
			return;
		}

		const [cfgRes, intentRes] = await Promise.all([
			fetch('/api/stripe-config'),
			fetch('/api/create-payment-intent', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + authToken,
				},
				body: JSON.stringify({ productIds, promoCode }),
			}),
		]);

		const cfg = await cfgRes.json().catch(() => ({}));
		const intent = await intentRes.json().catch(() => ({}));
		if (!cfgRes.ok) throw new Error(cfg.error || 'Stripe configuration error.');
		if (!intentRes.ok) throw new Error(intent.error || 'Failed to start checkout.');

		stripe = window.Stripe(cfg.publishableKey);
		elements = stripe.elements({
			clientSecret: intent.clientSecret,
			appearance: {
				theme: 'night',
				variables: {
					colorPrimary: '#ef4444',
					colorBackground: '#0b1020',
					colorText: '#f8fafc',
					borderRadius: '10px',
				},
			},
		});
		const paymentElement = elements.create('payment');
		paymentElement.mount('#payment-element');
	}

	form?.addEventListener('submit', async (e) => {
		e.preventDefault();
		if (!stripe || !elements) return;
		payButton.disabled = true;
		payButton.textContent = 'Processing...';
		setMessage('Processing payment...');
		try {
			const { error, paymentIntent } = await stripe.confirmPayment({
				elements,
				redirect: 'if_required',
			});
			if (error) throw new Error(error.message || 'Payment failed.');
			if (!paymentIntent || paymentIntent.status !== 'succeeded') {
				throw new Error('Payment was not completed.');
			}
			await finalizePayment(paymentIntent.id);
		} catch (err) {
			setMessage(err.message || 'Checkout failed. Please try again.', true);
			payButton.disabled = false;
			payButton.textContent = 'Pay now';
		}
	});

	initializeCheckout().catch((err) => {
		setMessage(err.message || 'Checkout initialization failed.', true);
		if (payButton) payButton.disabled = true;
	});
});
