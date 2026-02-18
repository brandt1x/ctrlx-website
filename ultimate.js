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
		const connectionDistance = tier === 'low' || lowPower ? 96 : 150;
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
			const coreFactor = cores <= 4 ? 0.82 : 1;
			const powerFactor = lowPower ? 0.72 : 1;
			const motionFactor = prefersReduced ? 0.58 : 1;
			const base = tier === 'low' ? 34 : tier === 'balanced' ? 56 : 82;
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

			if (tier === 'immersive' && !lowPower) {
				for (let i = 0; i < particles.length; i++) {
					for (let j = i + 1; j < particles.length; j++) {
						const dx = particles[i].x - particles[j].x;
						const dy = particles[i].y - particles[j].y;
						const distSq = dx * dx + dy * dy;
						if (distSq < connectionDistanceSq) {
							ctx.beginPath();
							ctx.moveTo(particles[i].x, particles[i].y);
							ctx.lineTo(particles[j].x, particles[j].y);
							ctx.strokeStyle = lineColor;
							ctx.lineWidth = 0.65;
							ctx.globalAlpha = 1 - (distSq / connectionDistanceSq);
							ctx.stroke();
							ctx.globalAlpha = 1;
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

	// Interactive tilt cards to make buying feel premium
	function initCardTilt() {
		const cards = document.querySelectorAll('.ultimate-tilt');
		if (!cards.length) return;
		const tier = (window.__Motion && window.__Motion.tier) || document.body.dataset.motionTier || 'balanced';
		const hasFine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
		if (tier !== 'immersive' || !hasFine) return;

		cards.forEach((card) => {
			card.addEventListener('mousemove', (e) => {
				const rect = card.getBoundingClientRect();
				const px = (e.clientX - rect.left) / rect.width;
				const py = (e.clientY - rect.top) / rect.height;
				const rotateX = (0.5 - py) * 9;
				const rotateY = (px - 0.5) * 12;
				card.style.transform = `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-6px)`;
			}, { passive: true });

			card.addEventListener('mouseleave', () => {
				card.style.transform = '';
			});
		});
	}

	function initMicroTilt() {
		const chips = document.querySelectorAll('.ultimate-tilt-chip');
		if (!chips.length) return;
		const tier = (window.__Motion && window.__Motion.tier) || document.body.dataset.motionTier || 'balanced';
		const hasFine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
		if (tier !== 'immersive' || !hasFine) return;

		chips.forEach((chip) => {
			chip.addEventListener('mousemove', (e) => {
				const rect = chip.getBoundingClientRect();
				const px = (e.clientX - rect.left) / rect.width;
				const py = (e.clientY - rect.top) / rect.height;
				const rotateX = (0.5 - py) * 4;
				const rotateY = (px - 0.5) * 6;
				chip.style.transform = `perspective(650px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
			}, { passive: true });
			chip.addEventListener('mouseleave', () => {
				chip.style.transform = '';
			});
		});
	}

	function initReactiveHover() {
		const reactiveNodes = document.querySelectorAll('.ultimate-reactive');
		if (!reactiveNodes.length) return;
		const tier = (window.__Motion && window.__Motion.tier) || document.body.dataset.motionTier || 'balanced';
		const hasFine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
		if (tier !== 'immersive' || !hasFine) return;

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

			function paint() {
				raf = 0;
				for (let i = 0; i < letters.length; i++) {
					const letter = letters[i];
					if (letter.classList.contains('ultimate-letter-space')) continue;
					const rect = letter.getBoundingClientRect();
					const cx = rect.left + rect.width * 0.5;
					const cy = rect.top + rect.height * 0.5;
					const dist = Math.hypot(mx - cx, my - cy);
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

	// Add-to-cart for ULTIMATE products is handled in script.js (runs after cart setup)

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			initCanvas();
			initCardTilt();
			initMicroTilt();
			initReactiveHover();
			initScrollReveal();
		});
	} else {
		initCanvas();
		initCardTilt();
		initMicroTilt();
		initReactiveHover();
		initScrollReveal();
	}
})();
