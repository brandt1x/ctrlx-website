// Populate current year and add UI behaviors
document.addEventListener('DOMContentLoaded', function () {
	const yearEl = document.getElementById('year');
	if (yearEl) yearEl.textContent = new Date().getFullYear();

	// Add stagger index for each card for CSS delay
	const cards = document.querySelectorAll('.card');
	cards.forEach((c, i) => c.style.setProperty('--i', i));

	// ─── MOTION SYSTEM ───────────────────────────────────────────────
	const Motion = (function () {
		const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const finePointer = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
		const flags = { heroV2: true, cardsV2: true, parallaxV2: true, immersiveTier: true };
		// Load overrides from localStorage (e.g. localStorage.setItem('motion.flags','{"heroV2":false}'))
		try {
			var stored = window.localStorage && localStorage.getItem('motion.flags');
			if (stored) {
				var ov = JSON.parse(stored);
				Object.keys(ov).forEach(function (k) { if (k in flags) flags[k] = !!ov[k]; });
			}
		} catch (_) { }

		function detectTier() {
			if (reduced) return 'low';
			const cores = navigator.hardwareConcurrency || 2;
			const mem = navigator.deviceMemory || 4;
			if (cores <= 2 || mem <= 2) return 'low';
			if (cores <= 4 || mem <= 4) return 'balanced';
			return 'immersive';
		}
		const tier = detectTier();
		document.body.dataset.motionTier = tier;

		// Unified RAF scheduler — one loop for all effects
		const _cbs = new Map();
		let _id = 0;
		let _on = false;
		function _tick(t) {
			for (const [, fn] of _cbs) fn(t);
			if (_cbs.size) { _id = requestAnimationFrame(_tick); } else { _on = false; }
		}
		function registerRAF(key, fn) {
			_cbs.set(key, fn);
			if (!_on) { _on = true; _id = requestAnimationFrame(_tick); }
		}
		function unregisterRAF(key) {
			_cbs.delete(key);
			if (!_cbs.size && _on) { cancelAnimationFrame(_id); _on = false; }
		}

		// Unified IntersectionObserver factory
		function observe(els, cb, opts) {
			opts = opts || {};
			if (!els || !els.length) return null;
			if (!('IntersectionObserver' in window)) {
				els.forEach(function (el) { cb(el, true); });
				return null;
			}
			const io = new IntersectionObserver(function (entries) {
				entries.forEach(function (e) {
					if (e.isIntersecting) {
						cb(e.target, true);
						if (!opts.persistent) io.unobserve(e.target);
					} else if (opts.persistent) {
						cb(e.target, false);
					}
				});
			}, { threshold: opts.threshold || 0.15, rootMargin: opts.rootMargin || '0px 0px -50px 0px' });
			els.forEach(function (el) { io.observe(el); });
			return io;
		}

		return { reduced, finePointer, flags, tier, registerRAF, unregisterRAF, observe };
	})();
	window.__Motion = Motion; // expose for cinematic.js

	// ─── Unified reveal system (replaces 3 separate reveal IIFEs) ───
	(function initReveals() {
		// 1. Section reveals with staggered children
		const sections = document.querySelectorAll('[data-scroll-section]');
		Motion.observe(sections, function (section) {
			section.classList.add('scroll-visible');
			const children = section.querySelectorAll('[data-scroll-item]');
			children.forEach(function (child, i) {
				setTimeout(function () { child.classList.add('scroll-visible'); }, i * 100);
			});
		}, { threshold: 0.12 });

		// 2. Standalone element reveals
		const standalones = document.querySelectorAll('.card, .hero, .how, .faq, .contact, .cart, .services h3');
		if (standalones.length) {
			standalones.forEach(function (el) { el.classList.add('js-reveal'); });
			Motion.observe(standalones, function (el) {
				el.classList.add('js-reveal-visible');
			}, { threshold: 0.18 });
		}

		// 3. Headline cinematic reveals
		const headlines = document.querySelectorAll('main h2, main h3, .card h4, .how-step h4, .site-cart-header h2');
		if (headlines.length) {
			headlines.forEach(function (h) { h.classList.add('headline-reveal'); });
			Motion.observe(headlines, function (h) {
				h.classList.add('headline-live');
			}, { threshold: 0.25, rootMargin: '0px 0px -25px 0px' });
		}
	})();

	// ─── Hero V2: entrance sequence + pointer parallax ───
	(function initHeroSequence() {
		if (!Motion.flags.heroV2) return;
		const hero = document.querySelector('.hero-sequence');
		if (!hero) return;

		// Detect if the load overlay will play (mirrors setupSiteLoadAnimation conditions)
		let overlayWillPlay = false;
		if (!document.body.classList.contains('ultimate-page') && !Motion.reduced) {
			const nav = performance.getEntriesByType?.('navigation')?.[0];
			const navType = nav?.type || (performance.navigation?.type === 1 ? 'reload' : 'navigate');
			const ref = document.referrer || '';
			let sameOrigin = false;
			if (ref) {
				try { sameOrigin = new URL(ref).origin === window.location.origin; }
				catch (_) { sameOrigin = ref.startsWith(window.location.origin || ''); }
			}
			overlayWillPlay = !(navType === 'navigate' && sameOrigin);
		}
		// Hero entrance starts as load overlay is fading, or immediately for internal nav
		setTimeout(function () { hero.classList.add('hero-entered'); }, overlayWillPlay ? 1750 : 200);

		// Pointer-driven parallax
		if (!Motion.reduced && Motion.finePointer) {
			const layer = hero.querySelector('.hero-parallax-layer');
			if (layer) {
				let mx = 0, my = 0, cx = 0, cy = 0;
				hero.addEventListener('mousemove', function (e) {
					const rect = hero.getBoundingClientRect();
					mx = (e.clientX - rect.left) / rect.width - 0.5;
					my = (e.clientY - rect.top) / rect.height - 0.5;
				}, { passive: true });
				hero.addEventListener('mouseleave', function () { mx = 0; my = 0; });

				Motion.registerRAF('heroParallax', function () {
					cx += (mx - cx) * 0.08;
					cy += (my - cy) * 0.08;
					layer.style.transform = 'translate(' + (cx * 30).toFixed(1) + 'px,' + (cy * 20).toFixed(1) + 'px) scale(1.06)';
				});
			}
		}
	})();

	// Ensure add-to-cart helper exists even on pages without cart UI
	if (!window.__addToSiteCart) {
		window.__addToSiteCart = function (name, rawPrice) {
			let priceNum = 0;
			if (typeof rawPrice === 'number') {
				priceNum = rawPrice;
			} else if (typeof rawPrice === 'string') {
				const match = rawPrice.replace(/[^0-9.]/g, '');
				priceNum = parseFloat(match || '0') || 0;
			}
			Cart.addItem(name || 'Item', priceNum);
		};
	}

	// ─── Motion card system: depth-shine + stagger indices ───
	(function initMotionCards() {
		if (!Motion.flags.cardsV2) return;

		// Extend stagger indices beyond .card to how-steps, faq items, zen-products
		const staggerGroups = [
			'.cards .card', '.zen-grid .card', '.how-steps .how-step',
			'.faq-vertical details', '.how-chips .how-chip'
		];
		staggerGroups.forEach(function (sel) {
			document.querySelectorAll(sel).forEach(function (el, i) {
				el.style.setProperty('--stagger-i', i);
			});
		});

		// Apply depth-shine cursor tracking on fine-pointer devices
		if (Motion.finePointer && !Motion.reduced) {
			const targets = document.querySelectorAll('.card, .how-step, .how-intro, .faq details');
			targets.forEach(function (el) {
				el.classList.add('depth-shine');
				el.addEventListener('mousemove', function (e) {
					var rect = el.getBoundingClientRect();
					var x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
					var y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
					el.style.setProperty('--mx', x + '%');
					el.style.setProperty('--my', y + '%');
				}, { passive: true });
			});
		}
	})();

	// (Enhanced scroll reveal merged into unified reveal system above)

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

	// Site load animation – only on first load or refresh, not when navigating via links
	(function setupSiteLoadAnimation() {
		if (document.body.classList.contains('ultimate-page')) return;
		const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (prefersReduced) return;

		const nav = performance.getEntriesByType?.('navigation')?.[0];
		const navType = nav?.type || (performance.navigation?.type === 1 ? 'reload' : 'navigate');
		const referrer = document.referrer || '';
		let sameOrigin = false;
		if (referrer) {
			try {
				sameOrigin = new URL(referrer).origin === window.location.origin;
			} catch {
				sameOrigin = referrer.startsWith(window.location.origin || '');
			}
		}
		if (navType === 'navigate' && sameOrigin) return; // Came from our site via link – skip

		const isLight = document.body.classList.contains('theme-light');
		const logoSrc = isLight ? 'images/whitelogo.png' : 'images/logo.png';
		const streaks = Array.from({ length: 12 }, (_, i) =>
			`<div class="site-load-streak" style="--delay:${(i * 0.08).toFixed(2)}s;--y:${(Math.random() * 100).toFixed(1)}%;--angle:${-15 + Math.random() * 30}deg;"></div>`
		).join('');
		const stars = Array.from({ length: 30 }, (_, i) =>
			`<span class="site-load-star" style="--delay:${(i * 0.03).toFixed(2)}s;--x:${(50 + Math.random() * 50).toFixed(1)}%;--y:${(Math.random() * 100).toFixed(1)}%;--dur:${(1 + Math.random() * 0.6).toFixed(2)}s;"></span>`
		).join('');

		const overlay = document.createElement('div');
		overlay.id = 'site-load-overlay';
		overlay.className = 'site-load-overlay' + (isLight ? ' site-load-mode-light' : '');
		overlay.setAttribute('aria-hidden', 'true');
		overlay.innerHTML = `
			<div class="site-load-layers">
				<div class="site-load-warp"></div>
				<div class="site-load-tunnel"></div>
				<div class="site-load-streaks">${streaks}</div>
				<div class="site-load-stars">${stars}</div>
			</div>
			<div class="site-load-center">
				<div class="site-load-brand-wrap">
					<img src="${logoSrc}" alt="Control-X" class="site-load-brand-img" />
				</div>
				<div class="site-load-pulse"></div>
				<div class="site-load-title">Control-X</div>
				<div class="site-load-subtitle">Precision Scripts</div>
			</div>
			<div class="site-load-hyperspace">
				<div class="site-load-zoom-line"></div>
				<div class="site-load-hyperspace-streaks"></div>
			</div>
		`;
		document.body.insertBefore(overlay, document.body.firstChild);

		// After initial animation: rapid line generation + zoom
		setTimeout(() => {
			overlay.classList.add('site-load-hyperspace-active');
			overlay.querySelector('.site-load-center')?.classList.add('site-load-center-out');

			const container = overlay.querySelector('.site-load-hyperspace-streaks');
			const cx = 50, cy = 50;
			const colors = ['red', 'coral', 'darkred', 'brightred'];
			let count = 0;
			const spawn = () => {
				for (let i = 0; i < 18; i++) {
					const r = 25 + Math.sqrt(Math.random()) * 50;
					const theta = Math.random() * Math.PI * 2;
					const x = cx + Math.cos(theta) * r;
					const y = cy + Math.sin(theta) * r;
					const dx = cx - x, dy = cy - y;
					const dist = Math.hypot(dx, dy) || 1;
					const angleTowardCenter = Math.atan2(dy, dx) * 180 / Math.PI - 90;
					const spread = (Math.random() - 0.5) * 24;
					const angle = angleTowardCenter + spread;
					const len = 70 + dist * 0.5 + Math.random() * 90;
					const color = colors[count % 4];
					const el = document.createElement('div');
					el.className = `site-load-hyperspace-streak site-load-hs-${color}`;
					el.style.cssText = `--x:${x}%;--y:${y}%;--angle:${angle}deg;--len:${Math.max(60, Math.min(len, 280))}px;--delay:0s;`;
					container.appendChild(el);
					count++;
				}
			};
			spawn();
			const interval = setInterval(spawn, 18);
			setTimeout(() => clearInterval(interval), 480);
		}, 1200);
		setTimeout(() => {
			overlay.classList.add('site-load-done');
			setTimeout(() => overlay.remove(), 650);
		}, 1650);
	})();

	// Toggle loaded state to trigger CSS entrance animations
	setTimeout(() => document.body.classList.add('is-loaded'), 60);

	const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const hasFinePointer = window.matchMedia && window.matchMedia('(pointer:fine)').matches;

	if (!prefersReducedMotion) {
		document.body.classList.add('cinematic-enabled');
		document.body.classList.add('insane-mode');
	}

	// Cursor halo for premium desktop feel
	(function setupCursorHalo() {
		if (prefersReducedMotion || !hasFinePointer || document.body.classList.contains('ultimate-page')) return;
		const halo = document.createElement('div');
		halo.className = 'cursor-halo';
		document.body.appendChild(halo);
		let targetX = 0;
		let targetY = 0;
		let currentX = 0;
		let currentY = 0;
		let raf = 0;

		function tick() {
			currentX += (targetX - currentX) * 0.18;
			currentY += (targetY - currentY) * 0.18;
			halo.style.transform = `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)`;
			raf = requestAnimationFrame(tick);
		}

		window.addEventListener('mousemove', (e) => {
			targetX = e.clientX;
			targetY = e.clientY;
			halo.classList.add('active');
			if (!raf) raf = requestAnimationFrame(tick);
		}, { passive: true });

		window.addEventListener('mousedown', () => halo.classList.add('pressed'));
		window.addEventListener('mouseup', () => halo.classList.remove('pressed'));
		window.addEventListener('mouseleave', () => halo.classList.remove('active'));
	})();

	// Spotlight feedback on interactive elements
	(function setupInteractiveSpotlight() {
		if (prefersReducedMotion || !hasFinePointer) return;
		const targets = document.querySelectorAll('nav a, .btn, .select-btn, .card, .how-step, .how-intro, .faq details, .contact-info, .contact-link');
		if (!targets.length) return;
		targets.forEach((el) => {
			el.classList.add('interactive-spot');
			el.addEventListener('mousemove', (e) => {
				const rect = el.getBoundingClientRect();
				const x = ((e.clientX - rect.left) / rect.width) * 100;
				const y = ((e.clientY - rect.top) / rect.height) * 100;
				el.style.setProperty('--mx', `${x.toFixed(2)}%`);
				el.style.setProperty('--my', `${y.toFixed(2)}%`);
				el.classList.add('is-hot');
			}, { passive: true });
			el.addEventListener('mouseleave', () => {
				el.classList.remove('is-hot');
			});
		});
	})();

	// Subtle desktop tilt on core cards/blocks
	(function setupGlobalTilt() {
		if (prefersReducedMotion || !hasFinePointer || document.body.classList.contains('ultimate-page')) return;
		const targets = document.querySelectorAll('.card, .how-step, .how-intro, .faq details, .contact-info, .success-card');
		if (!targets.length) return;
		targets.forEach((el) => {
			el.addEventListener('mousemove', (e) => {
				const rect = el.getBoundingClientRect();
				const px = (e.clientX - rect.left) / rect.width;
				const py = (e.clientY - rect.top) / rect.height;
				const rx = (0.5 - py) * 5.5;
				const ry = (px - 0.5) * 6.5;
				el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
			}, { passive: true });
			el.addEventListener('mouseleave', () => {
				el.style.transform = '';
			});
		});
	})();

	// Premium magnetic feel on key controls
	(function setupMagneticControls() {
		if (prefersReducedMotion || !hasFinePointer) return;
		const targets = document.querySelectorAll('nav a, .btn, .select-btn, .cart-toggle, .theme-toggle, .site-cart-close, .site-cart-item-remove, .contact-link');
		if (!targets.length) return;
		targets.forEach((el) => {
			el.classList.add('magnetic');
			el.addEventListener('mousemove', (e) => {
				const rect = el.getBoundingClientRect();
				const px = (e.clientX - rect.left) / rect.width - 0.5;
				const py = (e.clientY - rect.top) / rect.height - 0.5;
				const max = el.classList.contains('btn') ? 5 : 4;
				el.style.setProperty('--mag-x', `${(px * max).toFixed(2)}px`);
				el.style.setProperty('--mag-y', `${(py * max).toFixed(2)}px`);
			}, { passive: true });
			el.addEventListener('mouseleave', () => {
				el.style.setProperty('--mag-x', '0px');
				el.style.setProperty('--mag-y', '0px');
			});
		});
	})();

	// Click shockwaves on nav/buttons/switches for insane feel
	(function setupClickBursts() {
		if (prefersReducedMotion || !hasFinePointer) return;
		const targets = document.querySelectorAll('nav a, .btn, .select-btn, .theme-toggle, .cart-toggle');
		if (!targets.length) return;

		targets.forEach((el) => {
			el.addEventListener('click', (e) => {
				const rect = el.getBoundingClientRect();
				const burst = document.createElement('span');
				burst.className = 'click-burst';
				if (document.body.classList.contains('theme-light')) {
					burst.classList.add('click-burst-light');
				}
				const x = e.clientX - rect.left;
				const y = e.clientY - rect.top;
				burst.style.left = `${x}px`;
				burst.style.top = `${y}px`;
				el.appendChild(burst);
				setTimeout(() => burst.remove(), 520);
			});
		});
	})();

	// Per-letter cursor glow on key text (like ULTIMATE mode)
	(function setupGlobalLetterGlow() {
		if (prefersReducedMotion || !hasFinePointer) return;
		if (document.body.classList.contains('ultimate-page')) return;

		const selectors = 'main h2, main h3, .card h4, .how-step h4, .hero h2, .price strong, nav a, .btn:not(.card-action-btn), .contact-info h4, .how-intro h4, .how-intro-label, .how-chip, .site-footer small';
		const targets = document.querySelectorAll(selectors);
		if (!targets.length) return;

		function splitLetters(node) {
			if (node.dataset.glowReady === '1') return;
			const text = node.textContent || '';
			if (!text.trim()) return;
			const frag = document.createDocumentFragment();
			for (let i = 0; i < text.length; i++) {
				const ch = text[i];
				const span = document.createElement('span');
				span.className = ch === ' ' ? 'glow-letter glow-letter-space' : 'glow-letter';
				span.textContent = ch === ' ' ? '\u00A0' : ch;
				frag.appendChild(span);
			}
			node.textContent = '';
			node.appendChild(frag);
			node.dataset.glowReady = '1';
		}

		targets.forEach((node) => {
			splitLetters(node);
			const letters = Array.from(node.querySelectorAll('.glow-letter'));
			if (!letters.length) return;

			let raf = 0;
			let mx = 0;
			let my = 0;
			const radius = 88;

			function paint() {
				raf = 0;
				for (let i = 0; i < letters.length; i++) {
					const letter = letters[i];
					if (letter.classList.contains('glow-letter-space')) continue;
					const rect = letter.getBoundingClientRect();
					const cx = rect.left + rect.width * 0.5;
					const cy = rect.top + rect.height * 0.5;
					const dist = Math.hypot(mx - cx, my - cy);
					const glow = Math.max(0, 1 - dist / radius);
					letter.style.setProperty('--g', glow.toFixed(3));
				}
			}

			node.addEventListener('mouseenter', () => node.classList.add('glow-active'));
			node.addEventListener('mouseleave', () => {
				node.classList.remove('glow-active');
				for (let i = 0; i < letters.length; i++) {
					letters[i].style.setProperty('--g', '0');
				}
			});
			node.addEventListener('mousemove', (e) => {
				mx = e.clientX;
				my = e.clientY;
				if (!raf) raf = requestAnimationFrame(paint);
			}, { passive: true });
		});
	})();

	// Whole-element hover color fade for body text (no letter split to preserve word wrap)
	(function setupTextHoverFade() {
		if (prefersReducedMotion || !hasFinePointer) return;
		if (document.body.classList.contains('ultimate-page')) return;

		const selectors = '.hero p, .card p, .card li, .how-step p, .how-intro p, .faq details summary, .faq details p, .contact-info p, .contact-link span, .zen-product p, .zen-product .price, .price, .services > .muted';
		const targets = document.querySelectorAll(selectors);
		if (!targets.length) return;

		targets.forEach((el) => {
			el.classList.add('text-hover-fade');
		});
	})();

	// (Headline reveal merged into unified reveal system above)

	// Cinematic internal page hop (non-ultimate links)
	(function setupPageHopTransition() {
		if (prefersReducedMotion) return;
		const links = document.querySelectorAll('a[href]');
		if (!links.length) return;
		let active = false;
		function isInternalHtml(href) {
			if (!href) return false;
			if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
			try {
				const url = new URL(href, window.location.href);
				return url.origin === window.location.origin && /\.html($|#|\?)/i.test(url.pathname + url.search + url.hash);
			} catch {
				return false;
			}
		}
		links.forEach((link) => {
			link.addEventListener('click', (e) => {
				const href = link.getAttribute('href') || '';
				if (!isInternalHtml(href)) return;
				if (/ultimate\.html/i.test(href)) return;
				if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
				if (active) return;
				active = true;
				e.preventDefault();
				const targetUrl = new URL(href, window.location.href).href;
				const path = new URL(targetUrl).pathname;
				const isHome = /\/index\.html$|\/$/.test(path) || path.endsWith('/index.html');
				const title = isHome ? 'HOME' : ((link.textContent || 'Entering').trim() || 'Entering');
				const overlay = document.createElement('div');
				overlay.className = 'page-hop-overlay';
				if (document.body.classList.contains('theme-light')) {
					overlay.classList.add('theme-light-hop');
				}
				overlay.innerHTML = `<div class="page-hop-core"><div class="page-hop-title">${title}</div></div>`;
				document.body.appendChild(overlay);
				requestAnimationFrame(() => overlay.classList.add('active'));
				setTimeout(() => {
					window.location.href = targetUrl;
				}, 460);
			});
		});
	})();

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
				checkoutBtn.textContent = 'Redirecting...';
				try {
					const apiBase = window.location.origin;
					const res = await fetch(`${apiBase}/api/create-checkout-session`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ items }),
					});
					const data = await res.json();
					if (data.url) {
						window.location.href = data.url;
					} else {
						throw new Error(data.error || 'Checkout failed');
					}
				} catch (err) {
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

	// Hide-on-scroll navbar: velocity-aware for smoother reveal
	(function setupNavHide() {
		const header = document.querySelector('.site-header');
		if (!header) return;
		header.classList.remove('hide');
		let lastY = window.scrollY;
		let lastT = Date.now();
		let ticking = false;
		const delta = 6;
		const velocityThreshold = 0.4; // px/ms — ignore slow scrolls
		const navLinks = document.querySelectorAll('.header-right nav a');
		navLinks.forEach(link => {
			link.addEventListener('click', () => { header.classList.remove('hide'); });
		});
		window.addEventListener('pageshow', () => { header.classList.remove('hide'); });
		function onScroll() {
			const y = window.scrollY;
			const now = Date.now();
			if (!ticking) {
				window.requestAnimationFrame(() => {
					const dy = y - lastY;
					const dt = Math.max(now - lastT, 1);
					const velocity = Math.abs(dy) / dt;
					if (Math.abs(dy) > delta) {
						if (dy > 0 && y > 80 && velocity > velocityThreshold) {
							header.classList.add('hide');
						} else if (dy < 0) {
							header.classList.remove('hide');
						}
						lastY = y;
						lastT = now;
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

	// Hero "CTRL-X Vision Setup" add-to-cart (index.html)
	; (function setupHeroAdd() {
		if (!window.__addToSiteCart) return;
		const btn = document.querySelector('.hero-add-btn');
		if (!btn) return;
		btn.addEventListener('click', () => {
			const name = btn.getAttribute('data-name') || 'CTRL-X Vision Setup';
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

	// Letter-by-letter cursor glow on ULTIMATE nav links
	; (function setupUltimateNavLetters() {
		const links = document.querySelectorAll('.nav-ultimate');
		if (!links.length) return;

		links.forEach((link) => {
			if (link.dataset.lettersReady === '1') return;
			const text = link.textContent || '';
			link.textContent = '';
			const frag = document.createDocumentFragment();
			for (let i = 0; i < text.length; i++) {
				const ch = text[i];
				const span = document.createElement('span');
				span.className = ch === ' ' ? 'nav-ultimate-letter nav-ultimate-letter-space' : 'nav-ultimate-letter';
				span.textContent = ch === ' ' ? '\u00A0' : ch;
				frag.appendChild(span);
			}
			link.appendChild(frag);
			link.dataset.lettersReady = '1';
			const letters = Array.from(link.querySelectorAll('.nav-ultimate-letter'));
			let raf = 0;
			let mx = 0;
			let my = 0;
			const radius = 90;

			function paint() {
				raf = 0;
				for (let i = 0; i < letters.length; i++) {
					const letter = letters[i];
					if (letter.classList.contains('nav-ultimate-letter-space')) continue;
					const rect = letter.getBoundingClientRect();
					const cx = rect.left + rect.width * 0.5;
					const cy = rect.top + rect.height * 0.5;
					const dist = Math.hypot(mx - cx, my - cy);
					const glow = Math.max(0, 1 - dist / radius);
					letter.style.setProperty('--glow', glow.toFixed(3));
				}
			}

			link.addEventListener('mousemove', (e) => {
				mx = e.clientX;
				my = e.clientY;
				if (!raf) raf = requestAnimationFrame(paint);
			});
			link.addEventListener('mouseleave', () => {
				for (let i = 0; i < letters.length; i++) {
					letters[i].style.setProperty('--glow', '0');
				}
			});
		});
	})();

	// Cinematic transition when opening ULTIMATE page
	; (function setupUltimateTransition() {
		const links = document.querySelectorAll('a[href="ultimate.html"]');
		if (!links.length) return;
		const currentPath = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
		let navigating = false;
		const MODE_KEY = 'ultimateTransitionMode';

		function nextMode() {
			const prev = sessionStorage.getItem(MODE_KEY) || 'dark';
			const next = prev === 'dark' ? 'cosmic' : 'dark';
			sessionStorage.setItem(MODE_KEY, next);
			return next;
		}

		function startTransition(href) {
			if (navigating) return;
			navigating = true;
			const isLight = document.body.classList.contains('theme-light');
			const mode = isLight ? 'light' : nextMode();
			const logoSrc = mode === 'light' ? 'images/whitelogo.png' : 'images/logo.png';
			const overlay = document.createElement('div');
			overlay.className = 'ultimate-loading-overlay';
			overlay.classList.add(`ultimate-mode-${mode}`);
			const sparks = Array.from({ length: 24 }, (_, i) =>
				`<span class="ultimate-loading-spark" style="--spark-delay:${(i * 0.06).toFixed(2)}s;--spark-x:${(Math.random() * 100).toFixed(1)}%;--spark-size:${(2 + Math.random() * 5).toFixed(1)}px;"></span>`
			).join('');
			overlay.innerHTML = `
				<div class="ultimate-loading-layers">
					<div class="ultimate-loading-beam"></div>
					<div class="ultimate-loading-grid"></div>
					<div class="ultimate-loading-nebula"></div>
					<div class="ultimate-loading-sparks">${sparks}</div>
				</div>
				<div class="ultimate-loading-center">
					<div class="ultimate-loading-brand-wrap">
						<img src="${logoSrc}" alt="Control-X" class="ultimate-loading-brand-img" />
					</div>
					<div class="ultimate-loading-logo">
						<span class="ultimate-logo-layer base">CTRLX</span>
						<span class="ultimate-logo-layer glitch g1">CTRLX</span>
						<span class="ultimate-logo-layer glitch g2">CTRLX</span>
						<span class="ultimate-logo-morph">ULTIMATE</span>
					</div>
					<div class="ultimate-loading-rings">
						<div class="ultimate-loading-ring"></div>
						<div class="ultimate-loading-ring"></div>
						<div class="ultimate-loading-ring"></div>
					</div>
					<div class="ultimate-loading-title">ULTIMATE</div>
					<div class="ultimate-loading-subtitle">${mode === 'light' ? 'Luminous Sequence • CONTROL+X' : mode === 'cosmic' ? 'Cosmic Surge • CONTROL+X' : 'Neural Sequence • VISION-X'}</div>
				</div>
			`;
			document.body.appendChild(overlay);
			requestAnimationFrame(() => overlay.classList.add('active'));
			const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			setTimeout(() => {
				window.location.href = href;
			}, prefersReduced ? 260 : 1280);
		}

		links.forEach((link) => {
			link.addEventListener('click', (e) => {
				if (currentPath === 'ultimate.html') return;
				if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
				e.preventDefault();
				startTransition(link.href);
			});
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

