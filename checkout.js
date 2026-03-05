document.addEventListener('DOMContentLoaded', () => {
	const yearEl = document.getElementById('year');
	if (yearEl) yearEl.textContent = new Date().getFullYear();

	const form = document.getElementById('checkout-form');
	const payButton = document.getElementById('pay-button');
	const payBtnText = document.querySelector('.co-pay-btn-text');
	const msgEl = document.getElementById('checkout-message');
	const itemsEl = document.getElementById('checkout-items');
	const subtotalEl = document.getElementById('checkout-subtotal');
	const discountRow = document.getElementById('co-discount-row');
	const discountEl = document.getElementById('checkout-discount');
	const totalEl = document.getElementById('checkout-total');
	const itemCountEl = document.getElementById('co-item-count');
	const overlay = document.getElementById('co-processing-overlay');

	const promoInput = document.getElementById('co-promo-input');
	const promoApplyBtn = document.getElementById('co-promo-apply');
	const promoWrap = document.getElementById('co-promo-wrap');
	const promoMsg = document.getElementById('co-promo-message');
	const promoSection = document.querySelector('.co-promo-section');

	const CART_KEY = 'siteCart';
	const PROMO_KEY = 'siteCartPromo';

	const VALID_PROMOS = ['2000!'];
	const PROMO_CUTOFF = new Date('2026-02-28T00:00:00Z');

	let stripe = null;
	let elements = null;
	let authToken = null;
	let currentPromo = null;
	let cartItems = [];
	let paymentIntentAmount = 0;

	function fmt(price) {
		return price % 1 === 0 ? `$${price}` : `$${price.toFixed(2)}`;
	}

	function setMessage(text, type) {
		if (!msgEl) return;
		msgEl.textContent = text || '';
		msgEl.className = 'co-message' + (type === 'error' ? ' co-message--error' : type === 'success' ? ' co-message--success' : '');
	}

	function setPromoMsg(text, type) {
		if (!promoMsg) return;
		promoMsg.textContent = text || '';
		promoMsg.className = 'co-promo-msg' + (type === 'success' ? ' co-promo-msg--success' : type === 'error' ? ' co-promo-msg--error' : '');
	}

	function getCartItems() {
		try {
			const raw = localStorage.getItem(CART_KEY);
			const parsed = JSON.parse(raw || '[]');
			if (!Array.isArray(parsed)) return [];
			const normalized = parsed.map((item) => {
				if (!item || typeof item !== 'object') return item;
				if ((item.productId || '').toLowerCase() === 'vision-x') {
					return { ...item, price: 200 };
				}
				if ((item.productId || '').toLowerCase() === 'aim-x') {
					return { ...item, price: 275 };
				}
				return item;
			});
			try { localStorage.setItem(CART_KEY, JSON.stringify(normalized)); } catch (_) {}
			return normalized;
		} catch (_) {
			return [];
		}
	}

	function getSavedPromo() {
		try {
			return (sessionStorage.getItem(PROMO_KEY) || '').trim().toUpperCase() || null;
		} catch (_) {
			return null;
		}
	}

	function isPromoValid(code) {
		if (!code) return false;
		return VALID_PROMOS.includes(code.toUpperCase().trim()) && new Date() < PROMO_CUTOFF;
	}

	function setPayBtnAmount(total) {
		if (payBtnText) {
			payBtnText.textContent = total > 0 ? `Pay ${fmt(total)}` : 'Pay now';
		}
	}

	function setPayBtnLoading(loading) {
		if (!payButton) return;
		payButton.disabled = loading;
		payButton.classList.toggle('co-pay-btn--loading', loading);
	}

	function showOverlay(show) {
		if (!overlay) return;
		overlay.hidden = !show;
		overlay.setAttribute('aria-hidden', String(!show));
	}

	function renderSummary() {
		const items = cartItems;
		const subtotal = items.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
		const hasDiscount = !!currentPromo;
		const discount = hasDiscount ? subtotal * 0.5 : 0;
		const total = subtotal - discount;

		if (itemCountEl) {
			itemCountEl.textContent = items.length === 1 ? '1 item' : `${items.length} items`;
		}

		if (itemsEl) {
			itemsEl.innerHTML = items.map((item) => {
				const price = Number(item.price) || 0;
				return `<li class="co-item">
					<span class="co-item-info">
						<span class="co-item-dot"></span>
						<span class="co-item-name">${item.name || 'Item'}</span>
					</span>
					<span class="co-item-price">${fmt(price)}</span>
				</li>`;
			}).join('');
		}

		if (subtotalEl) subtotalEl.textContent = fmt(subtotal);

		if (discountRow && discountEl) {
			discountRow.hidden = !hasDiscount;
			discountEl.textContent = hasDiscount ? `-${fmt(discount)}` : '-$0';
		}

		if (totalEl) totalEl.textContent = fmt(total);

		setPayBtnAmount(total);
		paymentIntentAmount = Math.round(total * 100);

		renderPromoState();
	}

	function renderPromoState() {
		if (!promoSection) return;

		if (currentPromo) {
			promoSection.innerHTML = `
				<div class="co-promo-active">
					<span class="co-promo-active-label">${currentPromo} — 50% off applied</span>
					<button type="button" class="co-promo-remove" id="co-promo-remove-btn">Remove</button>
				</div>`;
			const removeBtn = document.getElementById('co-promo-remove-btn');
			if (removeBtn) {
				removeBtn.addEventListener('click', () => {
					currentPromo = null;
					try { sessionStorage.removeItem(PROMO_KEY); } catch (_) {}
					restorePromoInput();
					renderSummary();
					reinitPaymentIntent();
				});
			}
		}
	}

	function restorePromoInput() {
		if (!promoSection) return;
		promoSection.innerHTML = `
			<div class="co-promo-input-wrap" id="co-promo-wrap">
				<input type="text" id="co-promo-input" class="co-promo-input" placeholder="Promo code" maxlength="20" autocomplete="off" spellcheck="false" />
				<button type="button" id="co-promo-apply" class="co-promo-apply">Apply</button>
			</div>
			<p id="co-promo-message" class="co-promo-msg"></p>`;
		attachPromoListeners();
	}

	function handleApplyPromo() {
		const input = document.getElementById('co-promo-input');
		const msg = document.getElementById('co-promo-message');
		if (!input) return;
		const code = input.value.trim().toUpperCase();
		if (!code) {
			if (msg) { msg.textContent = 'Enter a promo code.'; msg.className = 'co-promo-msg co-promo-msg--error'; }
			return;
		}
		if (isPromoValid(code)) {
			currentPromo = code;
			try { sessionStorage.setItem(PROMO_KEY, code); } catch (_) {}
			renderSummary();
			reinitPaymentIntent();
		} else {
			if (VALID_PROMOS.includes(code)) {
				if (msg) { msg.textContent = 'This promo has expired.'; msg.className = 'co-promo-msg co-promo-msg--error'; }
			} else {
				if (msg) { msg.textContent = 'Invalid promo code.'; msg.className = 'co-promo-msg co-promo-msg--error'; }
			}
		}
	}

	function attachPromoListeners() {
		const applyBtn = document.getElementById('co-promo-apply');
		const input = document.getElementById('co-promo-input');
		if (applyBtn) applyBtn.addEventListener('click', handleApplyPromo);
		if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleApplyPromo(); } });
	}

	async function reinitPaymentIntent() {
		if (!stripe || !authToken) return;
		const productIds = cartItems.filter(i => i && i.productId).map(i => i.productId);
		if (!productIds.length) return;

		try {
			const intentRes = await fetch('/api/create-payment-intent', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + authToken,
				},
				body: JSON.stringify({ productIds, promoCode: currentPromo }),
			});
			const intent = await intentRes.json().catch(() => ({}));
			if (!intentRes.ok) {
				setMessage(intent.error || 'Failed to update payment.', 'error');
				return;
			}

			elements = stripe.elements({
				clientSecret: intent.clientSecret,
				appearance: getStripeAppearance(),
			});
			const pe = elements.create('payment');
			const container = document.getElementById('payment-element');
			if (container) container.innerHTML = '';
			pe.mount('#payment-element');
			if (payButton) payButton.disabled = false;
			setMessage('');
		} catch (err) {
			setMessage('Failed to refresh payment. Please reload.', 'error');
		}
	}

	function getStripeAppearance() {
		const isLight = document.documentElement.classList.contains('theme-light');
		return {
			theme: isLight ? 'stripe' : 'night',
			variables: {
				colorPrimary: '#ef4444',
				colorBackground: isLight ? '#ffffff' : '#0d0d1a',
				colorText: isLight ? '#111827' : '#f8fafc',
				colorDanger: '#f43f5e',
				borderRadius: '10px',
				fontFamily: 'Inter, system-ui, sans-serif',
				spacingUnit: '4px',
			},
			rules: {
				'.Input': {
					border: isLight ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.1)',
					boxShadow: 'none',
					backgroundColor: isLight ? '#f9fafb' : 'rgba(255,255,255,0.03)',
					padding: '12px 14px',
				},
				'.Input:focus': {
					borderColor: '#ef4444',
					boxShadow: '0 0 0 3px rgba(239,68,68,0.12)',
				},
				'.Label': {
					fontWeight: '600',
					fontSize: '0.85rem',
					marginBottom: '6px',
				},
				'.Tab': {
					border: isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.08)',
					backgroundColor: isLight ? '#fff' : 'rgba(255,255,255,0.03)',
				},
				'.Tab--selected': {
					borderColor: '#ef4444',
					backgroundColor: isLight ? '#fff' : 'rgba(239,68,68,0.06)',
				},
			},
		};
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
		cartItems = getCartItems().filter(i => i && i.productId);
		const savedPromo = getSavedPromo();
		if (savedPromo && isPromoValid(savedPromo)) {
			currentPromo = savedPromo;
		}
		renderSummary();

		if (!cartItems.length) {
			setMessage('Your cart is empty. Add products before checkout.', 'error');
			if (payButton) payButton.disabled = true;
			return;
		}

		authToken = await getAuthToken();
		if (!authToken) {
			window.location.href = '/account.html?returnTo=checkout';
			return;
		}

		const productIds = cartItems.map(i => i.productId);

		const [cfgRes, intentRes] = await Promise.all([
			fetch('/api/stripe-config'),
			fetch('/api/create-payment-intent', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + authToken,
				},
				body: JSON.stringify({ productIds, promoCode: currentPromo }),
			}),
		]);

		const cfg = await cfgRes.json().catch(() => ({}));
		const intent = await intentRes.json().catch(() => ({}));
		if (!cfgRes.ok) throw new Error(cfg.error || 'Stripe configuration error.');
		if (!intentRes.ok) throw new Error(intent.error || 'Failed to start checkout.');

		stripe = window.Stripe(cfg.publishableKey);
		elements = stripe.elements({
			clientSecret: intent.clientSecret,
			appearance: getStripeAppearance(),
		});

		const paymentElement = elements.create('payment');
		const container = document.getElementById('payment-element');
		if (container) container.innerHTML = '';
		paymentElement.mount('#payment-element');

		paymentElement.on('ready', () => {
			if (payButton) payButton.disabled = false;
		});
	}

	form?.addEventListener('submit', async (e) => {
		e.preventDefault();
		if (!stripe || !elements) return;

		setPayBtnLoading(true);
		setMessage('');

		try {
			showOverlay(true);

			const { error, paymentIntent } = await stripe.confirmPayment({
				elements,
				redirect: 'if_required',
			});

			if (error) {
				showOverlay(false);
				throw new Error(error.message || 'Payment failed.');
			}

			if (!paymentIntent || paymentIntent.status !== 'succeeded') {
				showOverlay(false);
				throw new Error('Payment was not completed.');
			}

			await finalizePayment(paymentIntent.id);
		} catch (err) {
			showOverlay(false);
			setMessage(err.message || 'Checkout failed. Please try again.', 'error');
			setPayBtnLoading(false);
		}
	});

	attachPromoListeners();

	initializeCheckout().catch((err) => {
		setMessage(err.message || 'Checkout initialization failed.', 'error');
		if (payButton) payButton.disabled = true;
	});
});
