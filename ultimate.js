// ULTIMATE page — immersive background + interaction effects

(function () {
	'use strict';

	// Particle and energy-field background
	function initCanvas() {
		const canvas = document.getElementById('ultimate-canvas-bg');
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const tier = (window.__Motion && window.__Motion.tier) || document.body.dataset.motionTier || 'balanced';
		let particles = [];
		const mouse = { x: -9999, y: -9999, active: false };
		const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const cores = navigator.hardwareConcurrency || 4;
		const mem = navigator.deviceMemory || 4;
		const lowPower = cores <= 4 || mem <= 4;
		let particleCount = 90;
		const connectionDistance = tier === 'low' ? 120 : (lowPower ? 148 : 176);
		const connectionDistanceSq = connectionDistance * connectionDistance;
		const particleSpeed = tier === 'low' ? 0.22 : 0.42;
		let width = 0;
		let height = 0;
		let rafId = 0;
		let running = true;
		let dpr = 1;
		let lastFrame = 0;

		function resize() {
			width = window.innerWidth;
			height = window.innerHeight;
			dpr = tier === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 1.6);
			const densityFactor = width < 900 ? 0.85 : 1;
			const coreFactor = cores <= 4 ? 0.9 : 1;
			const powerFactor = lowPower ? 0.9 : 1;
			const motionFactor = prefersReduced ? 0.58 : 1;
			const base = tier === 'low' ? 44 : tier === 'balanced' ? 72 : 96;
			particleCount = Math.max(24, Math.round(base * densityFactor * coreFactor * powerFactor * motionFactor));
			canvas.width = Math.floor(width * dpr);
			canvas.height = Math.floor(height * dpr);
			canvas.style.width = `${width}px`;
			canvas.style.height = `${height}px`;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			initParticles();
		}

		function initParticles() {
			particles = [];
			for (let i = 0; i < particleCount; i++) {
				particles.push({
					x: Math.random() * width,
					y: Math.random() * height,
					vx: (Math.random() - 0.5) * particleSpeed,
					vy: (Math.random() - 0.5) * particleSpeed,
					radius: Math.random() * 1.8 + 0.6,
					pulse: Math.random() * Math.PI * 2,
				});
			}
		}

		function drawAura() {
			if (!mouse.active) return;
			const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 220);
			const isLight = document.body.classList.contains('theme-light');
			grad.addColorStop(0, isLight ? 'rgba(185, 28, 28, 0.22)' : 'rgba(239, 68, 68, 0.28)');
			grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.arc(mouse.x, mouse.y, 220, 0, Math.PI * 2);
			ctx.fill();
		}

		function animate(now) {
			if (!running) return;
			now = now || performance.now();
			if (tier === 'low' && now - lastFrame < 33) {
				rafId = requestAnimationFrame(animate);
				return;
			}
			lastFrame = now;
			ctx.fillStyle = document.body.classList.contains('theme-light')
				? 'rgba(249, 250, 251, 0.18)'
				: 'rgba(2, 1, 6, 0.22)';
			ctx.fillRect(0, 0, width, height);

			const isLight = document.body.classList.contains('theme-light');
			const lineColor = isLight ? 'rgba(185, 28, 28, 0.15)' : 'rgba(239, 68, 68, 0.24)';
			const dotColor = isLight ? 'rgba(185, 28, 28, 0.44)' : 'rgba(248, 113, 113, 0.58)';

			drawAura();

			for (let i = 0; i < particles.length; i++) {
				const p = particles[i];
				p.pulse += 0.02;
				p.x += p.vx;
				p.y += p.vy;
				if (p.x < 0 || p.x > width) p.vx *= -1;
				if (p.y < 0 || p.y > height) p.vy *= -1;

				if (mouse.active) {
					const dx = mouse.x - p.x;
					const dy = mouse.y - p.y;
					const dist = Math.sqrt(dx * dx + dy * dy) || 1;
					if (dist < 220) {
						const force = (220 - dist) / 2200;
						p.vx -= (dx / dist) * force;
						p.vy -= (dy / dist) * force;
					}
				}

				p.vx *= 0.995;
				p.vy *= 0.995;

				ctx.beginPath();
				ctx.arc(p.x, p.y, p.radius + Math.sin(p.pulse) * 0.35, 0, Math.PI * 2);
				ctx.fillStyle = dotColor;
				ctx.fill();
			}

			if (!prefersReduced) {
				const stride = tier === 'low' ? 2 : 1;
				const cellSize = connectionDistance + 2;
				const grid = Object.create(null);
				for (let i = 0; i < particles.length; i++) {
					const p = particles[i];
					const cx = Math.floor(p.x / cellSize);
					const cy = Math.floor(p.y / cellSize);
					const key = cx + ',' + cy;
					if (!grid[key]) grid[key] = [];
					grid[key].push(i);
				}
				const drawn = Object.create(null);
				for (let i = 0; i < particles.length; i += stride) {
					const p = particles[i];
					const cx = Math.floor(p.x / cellSize);
					const cy = Math.floor(p.y / cellSize);
					for (let dy = -1; dy <= 1; dy++) {
						for (let dx = -1; dx <= 1; dx++) {
							const key = (cx + dx) + ',' + (cy + dy);
							const cell = grid[key];
							if (!cell) continue;
							for (let k = 0; k < cell.length; k++) {
								const j = cell[k];
								if (j <= i || (stride > 1 && (j - i) % stride !== 1)) continue;
								const pairKey = i < j ? i + ',' + j : j + ',' + i;
								if (drawn[pairKey]) continue;
								const dxx = particles[i].x - particles[j].x;
								const dyy = particles[i].y - particles[j].y;
								const distSq = dxx * dxx + dyy * dyy;
								if (distSq < connectionDistanceSq) {
									drawn[pairKey] = true;
									ctx.beginPath();
									ctx.moveTo(particles[i].x, particles[i].y);
									ctx.lineTo(particles[j].x, particles[j].y);
									ctx.strokeStyle = lineColor;
									ctx.lineWidth = stride === 1 ? 0.7 : 0.5;
									ctx.globalAlpha = (1 - (distSq / connectionDistanceSq)) * (stride === 1 ? 1 : 0.75);
									ctx.stroke();
									ctx.globalAlpha = 1;
								}
							}
						}
					}
				}
			}

			rafId = requestAnimationFrame(animate);
		}

		window.addEventListener('mousemove', (e) => {
			mouse.x = e.clientX;
			mouse.y = e.clientY;
			mouse.active = true;
		}, { passive: true });
		window.addEventListener('mouseleave', () => {
			mouse.active = false;
		});
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				running = false;
				if (rafId) cancelAnimationFrame(rafId);
			} else if (!running) {
				running = true;
				animate();
			}
		});
		let resizeTimer;
		const resizeDebounce = tier === 'low' ? 200 : 120;
		window.addEventListener('resize', () => {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(resize, resizeDebounce);
		});
		resize();
		animate();
	}

	// Interactive tilt cards (throttled via RAF + delegation)
	function initCardTilt() {
		const cards = document.querySelectorAll('.ultimate-tilt');
		if (!cards.length) return;
		const hasFine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
		if (!hasFine) return;

		let lastEv = null;
		let scheduled = false;
		function apply() {
			scheduled = false;
			if (!lastEv) return;
			const card = lastEv.target.closest('.ultimate-tilt');
			if (card) {
				const under = document.elementFromPoint(lastEv.clientX, lastEv.clientY);
				if (!under || !card.contains(under)) {
					card.style.transform = '';
					return;
				}
				const rect = card.getBoundingClientRect();
				const px = (lastEv.clientX - rect.left) / rect.width;
				const py = (lastEv.clientY - rect.top) / rect.height;
				const rotateX = (0.5 - py) * 9;
				const rotateY = (px - 0.5) * 12;
				card.style.transform = `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-6px)`;
			}
		}
		document.addEventListener('mousemove', (e) => {
			lastEv = e;
			if (!scheduled) {
				scheduled = true;
				requestAnimationFrame(apply);
			}
		}, { passive: true });
		cards.forEach((card) => {
			card.addEventListener('mouseleave', () => { card.style.transform = ''; });
		});
	}

	function initMicroTilt() {
		const chips = document.querySelectorAll('.ultimate-tilt-chip');
		if (!chips.length) return;
		const hasFine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
		if (!hasFine) return;

		let lastEv = null;
		let scheduled = false;
		function apply() {
			scheduled = false;
			if (!lastEv) return;
			const chip = lastEv.target.closest('.ultimate-tilt-chip');
			if (chip) {
				const under = document.elementFromPoint(lastEv.clientX, lastEv.clientY);
				if (!under || !chip.contains(under)) {
					chip.style.transform = '';
					return;
				}
				const rect = chip.getBoundingClientRect();
				const px = (lastEv.clientX - rect.left) / rect.width;
				const py = (lastEv.clientY - rect.top) / rect.height;
				const rotateX = (0.5 - py) * 4;
				const rotateY = (px - 0.5) * 6;
				chip.style.transform = `perspective(650px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
			}
		}
		document.addEventListener('mousemove', (e) => {
			lastEv = e;
			if (!scheduled) {
				scheduled = true;
				requestAnimationFrame(apply);
			}
		}, { passive: true });
		chips.forEach((chip) => {
			chip.addEventListener('mouseleave', () => { chip.style.transform = ''; });
		});
	}

	function initReactiveHover() {
		const reactiveNodes = document.querySelectorAll('.ultimate-reactive');
		if (!reactiveNodes.length) return;
		const hasFine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
		if (!hasFine) return;

		const runWhenIdle = (fn) => {
			if (typeof requestIdleCallback !== 'undefined') {
				requestIdleCallback(fn, { timeout: 500 });
			} else {
				setTimeout(fn, 0);
			}
		};

		function splitLetters(node) {
			if (node.dataset.lettersReady === '1') return;
			const text = node.textContent || '';
			if (!text.trim()) return;

			const frag = document.createDocumentFragment();
			for (let i = 0; i < text.length; i++) {
				const ch = text[i];
				const span = document.createElement('span');
				span.className = ch === ' ' ? 'ultimate-letter ultimate-letter-space' : 'ultimate-letter';
				span.textContent = ch === ' ' ? '\u00A0' : ch;
				span.style.setProperty('--letter-index', String(i));
				frag.appendChild(span);
			}
			node.textContent = '';
			node.appendChild(frag);
			node.dataset.lettersReady = '1';
		}

		let layoutInvalidTS = 0;
		window.addEventListener('scroll', () => { layoutInvalidTS = Date.now(); }, { passive: true });
		window.addEventListener('resize', () => { layoutInvalidTS = Date.now(); });

		runWhenIdle(() => {
		reactiveNodes.forEach((node) => {
			const wantsLetterFlow = node.classList.contains('ultimate-letterflow');
			if (wantsLetterFlow) splitLetters(node);
			const letters = Array.from(node.querySelectorAll('.ultimate-letter'));
			if (wantsLetterFlow && !letters.length) return;

			let raf = 0;
			let mx = 0;
			let my = 0;
			const radius = 96;
			let cache = null;
			let cacheTS = 0;

			function refreshCache() {
				cache = [];
				for (let i = 0; i < letters.length; i++) {
					const letter = letters[i];
					if (letter.classList.contains('ultimate-letter-space')) { cache.push(null); continue; }
					const rect = letter.getBoundingClientRect();
					cache.push({ cx: rect.left + rect.width * 0.5, cy: rect.top + rect.height * 0.5 });
				}
				cacheTS = Date.now();
			}

			function paint() {
				raf = 0;
				if (!cache || layoutInvalidTS > cacheTS) refreshCache();
				for (let i = 0; i < letters.length; i++) {
					const letter = letters[i];
					if (letter.classList.contains('ultimate-letter-space')) continue;
					const c = cache[i];
					if (!c) continue;
					const dist = Math.hypot(mx - c.cx, my - c.cy);
					const glow = Math.max(0, 1 - dist / radius);
					letter.style.setProperty('--glow', glow.toFixed(3));
					letter.style.setProperty('--lift', `${(-glow * 3.2).toFixed(2)}px`);
				}
			}

			node.addEventListener('mouseenter', () => node.classList.add('is-hovered'));
			node.addEventListener('mouseleave', () => {
				node.classList.remove('is-hovered');
				for (let i = 0; i < letters.length; i++) {
					letters[i].style.setProperty('--glow', '0');
					letters[i].style.setProperty('--lift', '0px');
				}
			});
			node.addEventListener('mousemove', (e) => {
				mx = e.clientX;
				my = e.clientY;
				if (!raf) raf = requestAnimationFrame(paint);
			}, { passive: true });
		});
		});
	}

	function initScrollReveal() {
		const targets = document.querySelectorAll('.ultimate-reveal');
		if (!targets.length || !('IntersectionObserver' in window)) {
			targets.forEach((el) => el.classList.add('is-visible'));
			return;
		}

		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.classList.add('is-visible');
					observer.unobserve(entry.target);
				}
			});
		}, { threshold: 0.16, rootMargin: '0px 0px -40px 0px' });

		targets.forEach((el) => observer.observe(el));
	}

	// Vision-X gallery overlay + lightbox
	function initVisionXGallery() {
		const btn = document.querySelector('[data-vision-x-gallery]');
		const overlay = document.getElementById('vision-x-gallery');
		const lightbox = document.getElementById('vision-x-lightbox');
		const cartToggle = document.getElementById('site-cart-toggle');
		const topbar = document.querySelector('.ultimate-topbar');
		if (!btn || !overlay || !lightbox) return;
		const close = overlay.querySelector('.ultimate-gallery-close');
		const backdrop = overlay.querySelector('[data-close-gallery]');
		const thumbs = overlay.querySelectorAll('.ultimate-gallery-thumb');
		const lightboxImg = lightbox.querySelector('.ultimate-lightbox-content img');
		const lightboxBackdrop = lightbox.querySelector('[data-close-lightbox]');
		const lightboxClose = lightbox.querySelector('.ultimate-lightbox-close');
		const lightboxPrev = lightbox.querySelector('.ultimate-lightbox-prev');
		const lightboxNext = lightbox.querySelector('.ultimate-lightbox-next');
		const images = Array.from(thumbs).map((t) => t.querySelector('img')).filter(Boolean).map((img) => ({ src: img.src, alt: img.alt }));
		let currentIndex = 0;

		function openGallery() {
			overlay.hidden = false;
			overlay.setAttribute('aria-hidden', 'false');
			document.body.style.overflow = 'hidden';
			if (cartToggle) cartToggle.style.visibility = 'hidden';
			if (topbar) topbar.style.visibility = 'hidden';
		}
		function closeGallery() {
			overlay.hidden = true;
			overlay.setAttribute('aria-hidden', 'true');
			document.body.style.overflow = '';
			if (cartToggle) cartToggle.style.visibility = '';
			if (topbar) topbar.style.visibility = '';
		}
		function openLightbox(index) {
			if (!images.length) return;
			currentIndex = ((index % images.length) + images.length) % images.length;
			lightboxImg.src = images[currentIndex].src;
			lightboxImg.alt = images[currentIndex].alt;
			lightbox.hidden = false;
			lightbox.setAttribute('aria-hidden', 'false');
		}
		function closeLightbox() {
			lightbox.hidden = true;
			lightbox.setAttribute('aria-hidden', 'true');
		}
		function goPrev() {
			currentIndex = (currentIndex - 1 + images.length) % images.length;
			lightboxImg.src = images[currentIndex].src;
			lightboxImg.alt = images[currentIndex].alt;
		}
		function goNext() {
			currentIndex = (currentIndex + 1) % images.length;
			lightboxImg.src = images[currentIndex].src;
			lightboxImg.alt = images[currentIndex].alt;
		}

		btn.addEventListener('click', openGallery);
		if (close) close.addEventListener('click', (e) => { e.stopPropagation(); closeGallery(); });
		if (backdrop) backdrop.addEventListener('click', closeGallery);
		overlay.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') closeGallery();
		});

		thumbs.forEach((thumb, i) => {
			thumb.addEventListener('click', (e) => {
				e.stopPropagation();
				openLightbox(i);
			});
		});

		if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);
		if (lightboxClose) lightboxClose.addEventListener('click', (e) => { e.stopPropagation(); closeLightbox(); });
		if (lightboxPrev) lightboxPrev.addEventListener('click', (e) => { e.stopPropagation(); goPrev(); });
		if (lightboxNext) lightboxNext.addEventListener('click', (e) => { e.stopPropagation(); goNext(); });

		document.addEventListener('keydown', (e) => {
			if (lightbox.hidden) return;
			if (e.key === 'Escape') closeLightbox();
			if (e.key === 'ArrowLeft') goPrev();
			if (e.key === 'ArrowRight') goNext();
		});
	}

	// AIM-X gallery overlay + lightbox
	function initAimXGallery() {
		const btn = document.querySelector('[data-aim-x-gallery]');
		const overlay = document.getElementById('aim-x-gallery');
		const lightbox = document.getElementById('aim-x-lightbox');
		const cartToggle = document.getElementById('site-cart-toggle');
		const topbar = document.querySelector('.ultimate-topbar');
		if (!btn || !overlay || !lightbox) return;
		const close = overlay.querySelector('.ultimate-gallery-close');
		const backdrop = overlay.querySelector('[data-close-aim-x-gallery]');
		const thumbs = overlay.querySelectorAll('.ultimate-gallery-thumb');
		const lightboxImg = lightbox.querySelector('.ultimate-lightbox-content img');
		const lightboxBackdrop = lightbox.querySelector('[data-close-aim-x-lightbox]');
		const lightboxClose = lightbox.querySelector('.ultimate-lightbox-close');
		const lightboxPrev = lightbox.querySelector('.ultimate-lightbox-prev');
		const lightboxNext = lightbox.querySelector('.ultimate-lightbox-next');
		const images = Array.from(thumbs).map((t) => t.querySelector('img')).filter(Boolean).map((img) => ({ src: img.src, alt: img.alt }));
		let currentIndex = 0;

		function openGallery() {
			overlay.hidden = false;
			overlay.setAttribute('aria-hidden', 'false');
			document.body.style.overflow = 'hidden';
			if (cartToggle) cartToggle.style.visibility = 'hidden';
			if (topbar) topbar.style.visibility = 'hidden';
		}
		function closeGallery() {
			overlay.hidden = true;
			overlay.setAttribute('aria-hidden', 'true');
			document.body.style.overflow = '';
			if (cartToggle) cartToggle.style.visibility = '';
			if (topbar) topbar.style.visibility = '';
		}
		function openLightbox(index) {
			if (!images.length) return;
			currentIndex = ((index % images.length) + images.length) % images.length;
			lightboxImg.src = images[currentIndex].src;
			lightboxImg.alt = images[currentIndex].alt;
			lightbox.hidden = false;
			lightbox.setAttribute('aria-hidden', 'false');
		}
		function closeLightbox() {
			lightbox.hidden = true;
			lightbox.setAttribute('aria-hidden', 'true');
		}
		function goPrev() {
			currentIndex = (currentIndex - 1 + images.length) % images.length;
			lightboxImg.src = images[currentIndex].src;
			lightboxImg.alt = images[currentIndex].alt;
		}
		function goNext() {
			currentIndex = (currentIndex + 1) % images.length;
			lightboxImg.src = images[currentIndex].src;
			lightboxImg.alt = images[currentIndex].alt;
		}

		btn.addEventListener('click', openGallery);
		if (close) close.addEventListener('click', (e) => { e.stopPropagation(); closeGallery(); });
		if (backdrop) backdrop.addEventListener('click', closeGallery);
		overlay.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') closeGallery();
		});

		thumbs.forEach((thumb, i) => {
			thumb.addEventListener('click', (e) => {
				e.stopPropagation();
				openLightbox(i);
			});
		});

		if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);
		if (lightboxClose) lightboxClose.addEventListener('click', (e) => { e.stopPropagation(); closeLightbox(); });
		if (lightboxPrev) lightboxPrev.addEventListener('click', (e) => { e.stopPropagation(); goPrev(); });
		if (lightboxNext) lightboxNext.addEventListener('click', (e) => { e.stopPropagation(); goNext(); });

		document.addEventListener('keydown', (e) => {
			if (lightbox.hidden) return;
			if (e.key === 'Escape') closeLightbox();
			if (e.key === 'ArrowLeft') goPrev();
			if (e.key === 'ArrowRight') goNext();
		});
	}

	// Vision+X gallery overlay + lightbox
	function initVisionXPlusGallery() {
		const btn = document.querySelector('[data-vision-x-plus-gallery]');
		const overlay = document.getElementById('vision-x-plus-gallery');
		const lightbox = document.getElementById('vision-x-plus-lightbox');
		const cartToggle = document.getElementById('site-cart-toggle');
		const topbar = document.querySelector('.ultimate-topbar');
		if (!btn || !overlay || !lightbox) return;
		const close = overlay.querySelector('.ultimate-gallery-close');
		const backdrop = overlay.querySelector('[data-close-vision-x-plus-gallery]');
		const thumbs = overlay.querySelectorAll('.ultimate-gallery-thumb');
		const lightboxImg = lightbox.querySelector('.ultimate-lightbox-content img');
		const lightboxBackdrop = lightbox.querySelector('[data-close-vision-x-plus-lightbox]');
		const lightboxClose = lightbox.querySelector('.ultimate-lightbox-close');
		const lightboxPrev = lightbox.querySelector('.ultimate-lightbox-prev');
		const lightboxNext = lightbox.querySelector('.ultimate-lightbox-next');
		const images = Array.from(thumbs).map((t) => t.querySelector('img')).filter(Boolean).map((img) => ({ src: img.src, alt: img.alt }));
		let currentIndex = 0;

		function openGallery() {
			overlay.hidden = false;
			overlay.setAttribute('aria-hidden', 'false');
			document.body.style.overflow = 'hidden';
			if (cartToggle) cartToggle.style.visibility = 'hidden';
			if (topbar) topbar.style.visibility = 'hidden';
		}
		function closeGallery() {
			overlay.hidden = true;
			overlay.setAttribute('aria-hidden', 'true');
			document.body.style.overflow = '';
			if (cartToggle) cartToggle.style.visibility = '';
			if (topbar) topbar.style.visibility = '';
		}
		function openLightbox(index) {
			if (!images.length) return;
			currentIndex = ((index % images.length) + images.length) % images.length;
			lightboxImg.src = images[currentIndex].src;
			lightboxImg.alt = images[currentIndex].alt;
			lightbox.hidden = false;
			lightbox.setAttribute('aria-hidden', 'false');
		}
		function closeLightbox() {
			lightbox.hidden = true;
			lightbox.setAttribute('aria-hidden', 'true');
		}
		function goPrev() {
			currentIndex = (currentIndex - 1 + images.length) % images.length;
			lightboxImg.src = images[currentIndex].src;
			lightboxImg.alt = images[currentIndex].alt;
		}
		function goNext() {
			currentIndex = (currentIndex + 1) % images.length;
			lightboxImg.src = images[currentIndex].src;
			lightboxImg.alt = images[currentIndex].alt;
		}

		btn.addEventListener('click', openGallery);
		if (close) close.addEventListener('click', (e) => { e.stopPropagation(); closeGallery(); });
		if (backdrop) backdrop.addEventListener('click', closeGallery);
		overlay.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') closeGallery();
		});

		thumbs.forEach((thumb, i) => {
			thumb.addEventListener('click', (e) => {
				e.stopPropagation();
				openLightbox(i);
			});
		});

		if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);
		if (lightboxClose) lightboxClose.addEventListener('click', (e) => { e.stopPropagation(); closeLightbox(); });
		if (lightboxPrev) lightboxPrev.addEventListener('click', (e) => { e.stopPropagation(); goPrev(); });
		if (lightboxNext) lightboxNext.addEventListener('click', (e) => { e.stopPropagation(); goNext(); });

		document.addEventListener('keydown', (e) => {
			if (lightbox.hidden) return;
			if (e.key === 'Escape') closeLightbox();
			if (e.key === 'ArrowLeft') goPrev();
			if (e.key === 'ArrowRight') goNext();
		});
	}

	// Add-to-cart for ULTIMATE products is handled in script.js (runs after cart setup)

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			initCanvas();
			initCardTilt();
			initMicroTilt();
			initReactiveHover();
			initScrollReveal();
			initVisionXGallery();
			initVisionXPlusGallery();
			initAimXGallery();
		});
	} else {
		initCanvas();
		initCardTilt();
		initMicroTilt();
		initReactiveHover();
		initScrollReveal();
		initVisionXGallery();
		initVisionXPlusGallery();
		initAimXGallery();
	}
})();
