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

	const CART_KEY = 'siteCart';
	const PROMO_KEY = 'siteCartPromo';
	const GUEST_EMAIL_KEY = 'siteGuestCheckoutEmail';

	const VALID_PROMOS = ['2000!'];
	const PROMO_CUTOFF = new Date('2026-02-28T00:00:00Z');

	let authToken = null;
	let forceGuestMode = false;
	let currentPromo = null;
	let cartItems = [];
	let checkoutAmountCents = 0;

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
		checkoutAmountCents = Math.round(total * 100);

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
		if (payButton) payButton.disabled = checkoutAmountCents <= 0;
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
			let guestEmail = '';
			const useGuestFlow = !authToken || forceGuestMode;
			if (useGuestFlow) {
				guestEmail = String(guestEmailInput?.value || '').trim().toLowerCase();
				if (!isValidEmail(guestEmail)) {
					throw new Error('Enter a valid email for guest checkout.');
				}
				try { localStorage.setItem(GUEST_EMAIL_KEY, guestEmail); } catch (_) {}
			}

			const headers = {
				'Content-Type': 'application/json',
			};
			if (authToken && !useGuestFlow) {
				headers.Authorization = 'Bearer ' + authToken;
			}

			const res = await fetch('/api/create-checkout-session', {
				method: 'POST',
				headers,
				body: JSON.stringify({
					productIds,
					promoCode: currentPromo,
					customerEmail: guestEmail || undefined,
				}),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok || !data.url) {
				throw new Error(data.error || 'Failed to start checkout.');
			}
			window.location.href = data.url;
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
		});
	}

	initializeCheckout().catch((err) => {
		setMessage(err.message || 'Checkout initialization failed.', 'error');
		if (payButton) payButton.disabled = true;
	});
});
