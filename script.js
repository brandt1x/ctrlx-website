// Populate current year and add UI behaviors
document.addEventListener('DOMContentLoaded', function () {
	const yearEl = document.getElementById('year');
	if (yearEl) yearEl.textContent = new Date().getFullYear();

	// Add stagger index for each card for CSS delay
	const cards = document.querySelectorAll('.card');
	cards.forEach((c, i) => c.style.setProperty('--i', i));

	// Scroll-based reveal animations for cards/sections
	(function setupScrollReveal() {
		if (!('IntersectionObserver' in window)) return;
		const targets = document.querySelectorAll('.card, .hero, .how, .faq, .contact, .cart, .services h3');
		if (!targets.length) return;

		targets.forEach(el => el.classList.add('js-reveal'));

		const observer = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					entry.target.classList.add('js-reveal-visible');
					observer.unobserve(entry.target);
				}
			});
		}, { threshold: 0.18 });

		targets.forEach(el => observer.observe(el));
	})();

	// Enhanced scroll reveal for index page sections with up/down animations
	(function setupEnhancedScrollReveal() {
		if (!('IntersectionObserver' in window)) return;
		const sections = document.querySelectorAll('[data-scroll-section]');
		const items = document.querySelectorAll('[data-scroll-item]');
		if (!sections.length && !items.length) return;

		const sectionObserver = new IntersectionObserver((entries) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					entry.target.classList.add('scroll-visible');
					// Stagger child items with direction-based animations
					const children = entry.target.querySelectorAll('[data-scroll-item]');
					children.forEach((child, index) => {
						setTimeout(() => {
							child.classList.add('scroll-visible');
						}, index * 120);
					});
					sectionObserver.unobserve(entry.target);
				}
			});
		}, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

		sections.forEach(section => sectionObserver.observe(section));
	})();

	// THEME TOGGLE (dark red/black ↔ light)
	(function setupThemeToggle() {
		const STORAGE_KEY = 'theme';
		const body = document.body;
		const toggle = document.getElementById('theme-toggle');

		// Apply stored preference if present
		const stored = window.localStorage ? localStorage.getItem(STORAGE_KEY) : null;
		if (stored === 'light') {
			body.classList.add('theme-light');
		}

		function syncToggleIcon() {
			if (!toggle) return;
			const isLight = body.classList.contains('theme-light');
			toggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
		}

		syncToggleIcon();

		if (toggle) {
			toggle.addEventListener('click', () => {
				const isLight = body.classList.toggle('theme-light');
				if (window.localStorage) {
					localStorage.setItem(STORAGE_KEY, isLight ? 'light' : 'dark');
				}
				syncToggleIcon();
			});
		}
	})();

	// Toggle loaded state to trigger CSS entrance animations
	setTimeout(() => document.body.classList.add('is-loaded'), 60);

	// GLOBAL CART (all pages)
	const Cart = (function () {
		const STORAGE_KEY = 'siteCart';
		let items = [];

		function load() {
			try {
				if (!window.localStorage) return;
				const raw = localStorage.getItem(STORAGE_KEY);
				if (!raw) return;
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) items = parsed;
			} catch (e) { }
		}

		function save() {
			try {
				if (!window.localStorage) return;
				localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
			} catch (e) { }
		}

		function addItem(name, price) {
			const value = typeof price === 'number' && !Number.isNaN(price) ? price : 0;
			const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
			items.push({ id, name, price: value });
			save();
		}

		function clear() {
			items = [];
			save();
		}

		function remove(id) {
			items = items.filter(item => item.id !== id);
			save();
		}

		function getItems() {
			return items.slice();
		}

		function getTotal() {
			return items.reduce((sum, item) => sum + (item.price || 0), 0);
		}

		load();

		return { addItem, clear, remove, getItems, getTotal };
	})();

	(function setupCartUI() {
		const body = document.body;
		const toggle = document.getElementById('site-cart-toggle');
		const closeBtn = document.getElementById('site-cart-close');
		const backdrop = document.getElementById('site-cart-backdrop');
		const countEl = document.getElementById('site-cart-count');
		const itemsEl = document.getElementById('site-cart-items');
		const totalEl = document.getElementById('site-cart-total');
		const summaryEl = document.getElementById('site-cart-summary');
		const clearBtn = document.getElementById('site-cart-clear');

		if (!toggle || !itemsEl || !totalEl || !summaryEl || !countEl || !clearBtn || !backdrop) return;

		function render() {
			const items = Cart.getItems();
			if (!items.length) {
				itemsEl.innerHTML = '';
				summaryEl.textContent = 'No items in your cart yet.';
				totalEl.textContent = 'Total: $0';
				countEl.textContent = '0';
				return;
			}
			itemsEl.innerHTML = items.map(item => {
				const id = item.id || '';
				return `<li data-id="${id}">
					<div class="site-cart-item-main">
						<span class="site-cart-item-name">${item.name}</span>
						<span class="site-cart-item-price">$${item.price}</span>
					</div>
					<button class="site-cart-item-remove" type="button" data-id="${id}" aria-label="Remove item">🗑️</button>
				</li>`;
			}).join('');
			const total = Cart.getTotal();
			totalEl.textContent = `Total: $${total}`;
			summaryEl.textContent = `You have ${items.length} item${items.length > 1 ? 's' : ''} in your cart.`;
			countEl.textContent = String(items.length);

			// animate items in
			requestAnimationFrame(() => {
				const lis = itemsEl.querySelectorAll('li');
				lis.forEach((li, index) => {
					setTimeout(() => {
						li.classList.add('site-cart-item-visible');
					}, index * 40);
				});
			});
		}

		function openCart() {
			body.classList.add('site-cart-open');
			const cartEl = document.getElementById('site-cart');
			if (cartEl) cartEl.setAttribute('aria-hidden', 'false');
			backdrop.setAttribute('aria-hidden', 'false');
		}

		function closeCart() {
			body.classList.remove('site-cart-open');
			const cartEl = document.getElementById('site-cart');
			if (cartEl) cartEl.setAttribute('aria-hidden', 'true');
			backdrop.setAttribute('aria-hidden', 'true');
		}

		toggle.addEventListener('click', () => {
			if (body.classList.contains('site-cart-open')) {
				closeCart();
			} else {
				openCart();
			}
		});

		if (closeBtn) {
			closeBtn.addEventListener('click', closeCart);
		}

		backdrop.addEventListener('click', closeCart);

		clearBtn.addEventListener('click', () => {
			Cart.clear();
			render();
		});

		itemsEl.addEventListener('click', (e) => {
			const target = e.target;
			if (!(target instanceof HTMLElement)) return;
			if (target.classList.contains('site-cart-item-remove')) {
				const id = target.getAttribute('data-id');
				if (!id) return;
				Cart.remove(id);
				render();
			}
		});

		const checkoutBtn = document.getElementById('site-cart-checkout');
		function resetCheckoutButton() {
			if (checkoutBtn) {
				checkoutBtn.disabled = false;
				checkoutBtn.textContent = 'Checkout with Stripe';
			}
		}
		if (checkoutBtn) {
			checkoutBtn.addEventListener('click', async () => {
				const items = Cart.getItems();
				if (!items.length) {
					alert('Your cart is empty.');
					return;
				}
				checkoutBtn.disabled = true;
				checkoutBtn.textContent = 'Opening...';
				// Open window immediately (sync with click) to avoid popup blocker
				const checkoutWindow = window.open('', '_blank', 'noopener,noreferrer');
				try {
					const apiBase = window.location.origin;
					const res = await fetch(`${apiBase}/api/create-checkout-session`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ items }),
					});
					const data = await res.json();
					if (data.url) {
						if (checkoutWindow) {
							checkoutWindow.location.href = data.url;
						} else {
							window.location.href = data.url;
						}
					} else {
						throw new Error(data.error || 'Checkout failed');
					}
				} catch (err) {
					if (checkoutWindow) checkoutWindow.close();
					console.error(err);
					alert('Checkout failed. Please try again.');
				} finally {
					resetCheckoutButton();
				}
			});
			window.addEventListener('pageshow', resetCheckoutButton);
		}

		render();

		// Expose helper used by other setup blocks
		window.__addToSiteCart = function (name, rawPrice) {
			let priceNum = 0;
			if (typeof rawPrice === 'number') {
				priceNum = rawPrice;
			} else if (typeof rawPrice === 'string') {
				const match = rawPrice.replace(/[^0-9.]/g, '');
				priceNum = parseFloat(match || '0') || 0;
			}
			Cart.addItem(name || 'Item', priceNum);
			render();
		};
	})();

	// Hide-on-scroll navbar: slide away when scrolling down, show when scrolling up
	(function setupNavHide() {
		const header = document.querySelector('.site-header');
		if (!header) return;
		let lastY = window.scrollY;
		let ticking = false;
		const delta = 8; // threshold
		function onScroll() {
			const y = window.scrollY;
			if (!ticking) {
				window.requestAnimationFrame(() => {
					if (Math.abs(y - lastY) > delta) {
						if (y > lastY && y > 80) {
							// scrolling down
							header.classList.add('hide');
						} else if (y < lastY) {
							// scrolling up
							header.classList.remove('hide');
						}
						lastY = y;
					}
					ticking = false;
				});
				ticking = true;
			}
		}
		window.addEventListener('scroll', onScroll, { passive: true });
	})();

	// Main services "select" buttons cart (services.html)
	(function setupServicesCart() {
		const selectButtons = document.querySelectorAll('.select-btn[data-service]');
		if (!selectButtons.length || !window.__addToSiteCart) return;

		selectButtons.forEach(btn => {
			btn.addEventListener('click', () => {
				const service = btn.getAttribute('data-service') || 'Service';
				const price = btn.getAttribute('data-price') || '0';
				window.__addToSiteCart(service, price);
				const cartToggle = document.getElementById('site-cart-toggle');
				if (cartToggle) {
					cartToggle.classList.add('cart-toggle-pulse');
					setTimeout(() => cartToggle.classList.remove('cart-toggle-pulse'), 320);
				}
			});
		});
	})();

	// Zen scripts add-to-cart hooks (zen-scripts.html)
	; (function setupZenAddToCart() {
		const zenSection = document.getElementById('zen-scripts-page');
		if (!zenSection || !window.__addToSiteCart) return;
		const buttons = zenSection.querySelectorAll('.zen-add-btn');
		if (!buttons.length) return;

		buttons.forEach(btn => {
			btn.addEventListener('click', () => {
				const name = btn.getAttribute('data-name') || 'Zen Script';
				const price = btn.getAttribute('data-price') || '0';
				window.__addToSiteCart(name, price);
			});
		});
	})();

	// Hero "Secret Setup" add-to-cart (index.html)
	; (function setupHeroAdd() {
		if (!window.__addToSiteCart) return;
		const btn = document.querySelector('.hero-add-btn');
		if (!btn) return;
		btn.addEventListener('click', () => {
			const name = btn.getAttribute('data-name') || 'Secret Setup';
			const price = btn.getAttribute('data-price') || '0';
			window.__addToSiteCart(name, price);
			const cartToggle = document.getElementById('site-cart-toggle');
			if (cartToggle) {
				cartToggle.click();
			}
		});
	})();

	// FAQ accordion behavior
	; (function setupFaqAccordion() {
		const groups = document.querySelectorAll('.faq details');
		if (!groups.length) return;
		groups.forEach(d => {
			d.addEventListener('toggle', () => {
				if (!d.open) return;
				groups.forEach(other => {
					if (other !== d) other.open = false;
				});
			});
		});
	})();

	// Smooth scroll for in-page anchors
	; (function setupSmoothScroll() {
		const links = document.querySelectorAll('a[href^="#"]');
		if (!links.length) return;
		links.forEach(link => {
			link.addEventListener('click', (e) => {
				const href = link.getAttribute('href');
				if (!href) return;
				const target = document.querySelector(href);
				if (!target) return;
				e.preventDefault();
				target.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});
		});
	})();

	// Highlight active nav link
	; (function highlightNav() {
		const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
		const navLinks = document.querySelectorAll('.header-right nav a');
		if (!navLinks.length) return;
		navLinks.forEach(link => {
			const href = (link.getAttribute('href') || '').toLowerCase();
			if (!href) return;
			if (path === href || (path === '' && href === 'index.html')) {
				link.classList.add('nav-active');
			}
		});
	})();

	// Contact form handling with EmailJS
	(function setupContactForm() {
		const form = document.getElementById('contact-form');
		const formMsg = document.getElementById('form-msg');
		const clearBtn = document.getElementById('clear-btn');
		const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

		if (!form || !formMsg) return;

		// Initialize EmailJS (replace with your Public Key)
		if (typeof emailjs !== 'undefined') {
			emailjs.init('5JZIOhB9nTFZZfiVc'); // Replace with your EmailJS Public Key
		}

		// Helper function to show messages
		function showMessage(text, isError = false) {
			if (!formMsg) return;
			formMsg.textContent = text;
			formMsg.className = 'form-msg' + (isError ? ' error' : '');
		}

		if (form) {
			form.addEventListener('submit', async (e) => {
				e.preventDefault();

				// Basic validation
				const name = form.querySelector('#name')?.value.trim();
				const email = form.querySelector('#email')?.value.trim();
				const details = form.querySelector('#details')?.value.trim();

				if (!name || !email || !details) {
					showMessage('Please fill in all fields.', true);
					return;
				}

				// Check if EmailJS is loaded
				if (typeof emailjs === 'undefined') {
					showMessage('Email service is not available. Please try again later.', true);
					return;
				}

				// Disable submit button during submission
				if (submitBtn) submitBtn.disabled = true;
				showMessage('Sending request...');

				try {
					// Send email using EmailJS
					// Template expects: name, email, reply_to, message
					await emailjs.send(
						'service_4xnu2is',  // Your EmailJS Service ID
						'template_12vxe02', // Your EmailJS Template ID
						{
							name: name,
							email: email,
							reply_to: email,
							message: details
						}
					);

					showMessage('Request sent successfully! We will contact you shortly.');
					form.reset();

					// Reset cart selection if present
					const cartContent = document.getElementById('cart-content');
					if (cartContent) cartContent.textContent = 'No service selected.';
					const checkoutBtn = document.getElementById('checkout-btn');
					if (checkoutBtn) checkoutBtn.disabled = true;
				} catch (error) {
					console.error('EmailJS error:', error);
					showMessage('Failed to send request. Please try again or contact us directly.', true);
				} finally {
					if (submitBtn) submitBtn.disabled = false;
				}
			});
		}

		if (clearBtn) {
			clearBtn.addEventListener('click', () => {
				if (form) form.reset();
				if (formMsg) {
					formMsg.textContent = '';
					formMsg.className = 'form-msg';
				}
			});
		}
	})();
});

