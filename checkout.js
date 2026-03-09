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

	const promoMsg = document.getElementById('co-promo-message');
	const promoSection = document.querySelector('.co-promo-section');
	const guestToggleWrap = document.getElementById('co-guest-toggle-wrap');
	const guestModeToggle = document.getElementById('co-guest-mode-toggle');
	const guestEmailBlock = document.getElementById('co-guest-email-block');
	const guestEmailInput = document.getElementById('co-guest-email');
	const paymentElementContainer = document.getElementById('payment-element');

	const CART_KEY = 'siteCart';
	const PROMO_KEY = 'siteCartPromo';
	const GUEST_EMAIL_KEY = 'siteGuestCheckoutEmail';

	const PROMO_DISCOUNTS = { '2000!': 0.5, 'GOAT': 0.8 };
	const PROMO_CUTOFFS = { '2000!': new Date('2026-02-28T00:00:00Z'), 'GOAT': new Date('2026-03-10T03:59:59Z') };
	const VALID_PROMOS = Object.keys(PROMO_DISCOUNTS);

	let authToken = null;
	let forceGuestMode = false;
	let currentPromo = null;
	let cartItems = [];
	let checkoutAmountCents = 0;
	let stripe = null;
	let elements = null;
	let paymentElement = null;

	function fmt(price) {
		return price % 1 === 0 ? `$${price}` : `$${price.toFixed(2)}`;
	}

	function setMessage(text, type) {
		if (!msgEl) return;
		msgEl.textContent = text || '';
		msgEl.className = 'co-message' + (type === 'error' ? ' co-message--error' : type === 'success' ? ' co-message--success' : '');
	}

	function setPromoMsg(text, type) {
		const livePromoMsg = document.getElementById('co-promo-message');
		if (!livePromoMsg) return;
		livePromoMsg.textContent = text || '';
		livePromoMsg.className = 'co-promo-msg' + (type === 'success' ? ' co-promo-msg--success' : type === 'error' ? ' co-promo-msg--error' : '');
	}

	function getCartItems() {
		try {
			const raw = localStorage.getItem(CART_KEY);
			const parsed = JSON.parse(raw || '[]');
			if (!Array.isArray(parsed)) return [];
			const normalized = parsed.map((item) => {
				if (!item || typeof item !== 'object') return item;
				if ((item.productId || '').toLowerCase() === 'vision-x') {
					return { ...item, price: 450 };
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
		const normalized = code.toUpperCase().trim();
		const cutoff = PROMO_CUTOFFS[normalized];
		return VALID_PROMOS.includes(normalized) && cutoff && new Date() < cutoff;
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

	function clearPaymentElement() {
		if (paymentElementContainer) {
			paymentElementContainer.innerHTML = '';
		}
		paymentElement = null;
	}

	function showOverlay(show) {
		if (!overlay) return;
		overlay.hidden = !show;
		overlay.setAttribute('aria-hidden', String(!show));
	}

	function renderSummary() {
		const items = cartItems;
		const subtotal = items.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
		const multiplier = currentPromo && PROMO_DISCOUNTS[currentPromo] != null ? PROMO_DISCOUNTS[currentPromo] : 1;
		const hasDiscount = multiplier < 1;
		const discount = subtotal * (1 - multiplier);
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
		checkoutAmountCents = Math.round(total * 100);

		renderPromoState();
	}

	function renderPromoState() {
		if (!promoSection) return;

		if (currentPromo) {
			const pct = Math.round((1 - (PROMO_DISCOUNTS[currentPromo] ?? 1)) * 100);
			promoSection.innerHTML = `
				<div class="co-promo-active">
					<span class="co-promo-active-label">${currentPromo} — ${pct}% off applied</span>
					<button type="button" class="co-promo-remove" id="co-promo-remove-btn">Remove</button>
				</div>`;
			const removeBtn = document.getElementById('co-promo-remove-btn');
			if (removeBtn) {
				removeBtn.addEventListener('click', () => {
					currentPromo = null;
					try { sessionStorage.removeItem(PROMO_KEY); } catch (_) {}
					restorePromoInput();
					renderSummary();
					createOrRefreshPaymentElement().catch(() => {});
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
			createOrRefreshPaymentElement().catch(() => {});
		} else {
			if (VALID_PROMOS.includes(code.toUpperCase().trim())) {
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

	function isValidEmail(email) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
	}

	function renderGuestEmailVisibility() {
		const signedIn = !!authToken;
		if (guestToggleWrap) guestToggleWrap.hidden = !signedIn;
		if (guestModeToggle && signedIn) {
			guestModeToggle.textContent = forceGuestMode ? 'Use account checkout' : 'Checkout as guest instead';
		}
		if (!guestEmailBlock) return;
		const isGuest = !authToken || forceGuestMode;
		guestEmailBlock.hidden = !isGuest;
		if (guestEmailInput) {
			guestEmailInput.required = isGuest;
			guestEmailInput.disabled = !isGuest;
		}
		if (isGuest && guestEmailInput) {
			try {
				const saved = localStorage.getItem(GUEST_EMAIL_KEY);
				if (saved && !guestEmailInput.value) guestEmailInput.value = saved;
			} catch (_) {}
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

	async function createOrRefreshPaymentElement() {
		const productIds = cartItems.map((i) => i.productId).filter(Boolean);
		if (!productIds.length || checkoutAmountCents <= 0) {
			clearPaymentElement();
			if (payButton) payButton.disabled = true;
			return;
		}

		const useGuestFlow = !authToken || forceGuestMode;
		let guestEmail = '';
		if (useGuestFlow) {
			guestEmail = String(guestEmailInput?.value || '').trim().toLowerCase();
			if (!isValidEmail(guestEmail)) {
				clearPaymentElement();
				if (payButton) payButton.disabled = true;
				setMessage('Enter your email to load guest checkout.', 'error');
				return;
			}
		}

		const headers = { 'Content-Type': 'application/json' };
		if (authToken && !useGuestFlow) {
			headers.Authorization = 'Bearer ' + authToken;
		}

		const [cfgRes, intentRes] = await Promise.all([
			fetch('/api/stripe-config'),
			fetch('/api/create-payment-intent', {
				method: 'POST',
				headers,
				body: JSON.stringify({
					productIds,
					promoCode: currentPromo,
					customerEmail: useGuestFlow ? guestEmail : undefined,
				}),
			}),
		]);

		const cfg = await cfgRes.json().catch(() => ({}));
		const intent = await intentRes.json().catch(() => ({}));
		if (!cfgRes.ok) throw new Error(cfg.error || 'Stripe configuration error.');
		if (!intentRes.ok) throw new Error(intent.error || 'Failed to start checkout.');
		if (typeof window.Stripe !== 'function') {
			throw new Error('Stripe failed to load. Refresh and try again.');
		}

		if (!stripe) {
			stripe = window.Stripe(cfg.publishableKey);
		}
		elements = stripe.elements({
			clientSecret: intent.clientSecret,
			appearance: getStripeAppearance(),
		});
		clearPaymentElement();
		paymentElement = elements.create('payment');
		paymentElement.mount('#payment-element');
		paymentElement.on('ready', () => {
			if (payButton) payButton.disabled = false;
		});
		setMessage('');
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
		renderGuestEmailVisibility();
		if (payButton) payButton.disabled = true;
		try {
			await createOrRefreshPaymentElement();
		} catch (err) {
			setMessage(err.message || 'Checkout initialization failed.', 'error');
			if (payButton) payButton.disabled = true;
		}
	}

	form?.addEventListener('submit', async (e) => {
		e.preventDefault();
		const productIds = cartItems.map((i) => i.productId).filter(Boolean);
		if (!productIds.length || checkoutAmountCents <= 0) {
			setMessage('Your cart is empty. Add products before checkout.', 'error');
			return;
		}

		setPayBtnLoading(true);
		setMessage('');

		try {
			showOverlay(true);
			const useGuestFlow = !authToken || forceGuestMode;
			if (!stripe || !elements) {
				await createOrRefreshPaymentElement();
			}
			if (!stripe || !elements) {
				throw new Error('Payment form is not ready. Try again.');
			}

			let guestEmail = '';
			if (useGuestFlow) {
				guestEmail = String(guestEmailInput?.value || '').trim().toLowerCase();
				if (!isValidEmail(guestEmail)) {
					throw new Error('Enter a valid email for guest checkout.');
				}
				try { localStorage.setItem(GUEST_EMAIL_KEY, guestEmail); } catch (_) {}
			}

			const confirmParams = {};
			if (useGuestFlow) {
				confirmParams.payment_method_data = {
					billing_details: {
						email: guestEmail,
					},
				};
			}

			const { error, paymentIntent } = await stripe.confirmPayment({
				elements,
				redirect: 'if_required',
				confirmParams,
			});

			if (error) {
				throw new Error(error.message || 'Payment failed.');
			}
			if (!paymentIntent || paymentIntent.status !== 'succeeded') {
				throw new Error('Payment was not completed.');
			}

			try {
				localStorage.removeItem(CART_KEY);
				sessionStorage.removeItem(PROMO_KEY);
			} catch (_) {}

			if (useGuestFlow) {
				window.location.href = `/download.html?guest=1&payment_intent=${encodeURIComponent(paymentIntent.id)}`;
				return;
			}
			await finalizePayment(paymentIntent.id);
		} catch (err) {
			showOverlay(false);
			setMessage(err.message || 'Checkout failed. Please try again.', 'error');
			setPayBtnLoading(false);
		}
	});

	attachPromoListeners();
	if (guestModeToggle) {
		guestModeToggle.addEventListener('click', () => {
			forceGuestMode = !forceGuestMode;
			renderGuestEmailVisibility();
			createOrRefreshPaymentElement().catch((err) => {
				setMessage(err.message || 'Failed to refresh checkout.', 'error');
			});
		});
	}
	if (guestEmailInput) {
		guestEmailInput.addEventListener('blur', () => {
			createOrRefreshPaymentElement().catch((err) => {
				setMessage(err.message || 'Failed to refresh checkout.', 'error');
			});
		});
	}

	initializeCheckout().catch((err) => {
		setMessage(err.message || 'Checkout initialization failed.', 'error');
		if (payButton) payButton.disabled = true;
	});
});
