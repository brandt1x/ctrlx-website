// Global cinematic particle canvas — runs on all non-ultimate pages
// Quality tiers: low / balanced / immersive — driven by Motion system
(function () {
	'use strict';

	if (document.body.classList.contains('ultimate-page')) return;

	const canvas = document.getElementById('site-canvas-bg');
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const hasFine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;

	// ─── Tier configuration ───
	const tier = (window.__Motion && window.__Motion.tier) || document.body.dataset.motionTier || 'balanced';
	const TIER_CONFIG = {
		low:       { base: 28,  connDist: 100, speed: 0.22, mouseRadius: 120, auraRadius: 100 },
		balanced:  { base: 55,  connDist: 130, speed: 0.32, mouseRadius: 160, auraRadius: 150 },
		immersive: { base: 90,  connDist: 150, speed: 0.36, mouseRadius: 200, auraRadius: 200 },
	};
	const cfg = TIER_CONFIG[tier] || TIER_CONFIG.balanced;

	let particles = [];
	const mouse = { x: -9999, y: -9999, active: false };
	const connectionDistanceSq = cfg.connDist * cfg.connDist;
	const speed = cfg.speed;
	let width = 0;
	let height = 0;
	let rafId = 0;
	let running = true;
	let dpr = 1;
	let particleCount = cfg.base;

	// ─── FPS monitor — downgrades particle count if frame budget exceeded ───
	let fpsFrames = 0;
	let fpsLast = performance.now();
	let fpsCurrent = 60;
	let downgraded = false;

	function checkFPS(now) {
		fpsFrames++;
		if (now - fpsLast >= 1000) {
			fpsCurrent = fpsFrames;
			fpsFrames = 0;
			fpsLast = now;
			// Auto-downgrade if consistently below 40fps
			if (!downgraded && fpsCurrent < 40 && particles.length > 20) {
				downgraded = true;
				var keep = Math.max(20, Math.floor(particles.length * 0.6));
				particles.length = keep;
				particleCount = keep;
			}
		}
	}

	// ─── Hero burst: extra particles spawned once on first hero reveal ───
	let heroBurstFired = false;
	function fireHeroBurst() {
		if (heroBurstFired || tier === 'low') return;
		heroBurstFired = true;
		var count = tier === 'immersive' ? 24 : 12;
		var cx = width * 0.5;
		var cy = height * 0.3;
		for (var i = 0; i < count; i++) {
			var angle = Math.random() * Math.PI * 2;
			var v = 1.2 + Math.random() * 2;
			particles.push({
				x: cx + (Math.random() - 0.5) * 60,
				y: cy + (Math.random() - 0.5) * 40,
				vx: Math.cos(angle) * v,
				vy: Math.sin(angle) * v,
				radius: 0.8 + Math.random() * 1.5,
				pulse: Math.random() * Math.PI * 2,
				burst: true,
				life: 1.0,
			});
		}
	}

	// Hook into hero reveal (home hero or page-hero on services/zen/contact)
	(function watchHero() {
		var hero = document.querySelector('.hero, .hero-sequence, .page-hero');
		if (!hero || !('IntersectionObserver' in window)) return;
		var obs = new IntersectionObserver(function (entries) {
			if (entries[0] && entries[0].isIntersecting) {
				fireHeroBurst();
				obs.disconnect();
			}
		}, { threshold: 0.3 });
		obs.observe(hero);
	})();

	function resize() {
		width = window.innerWidth;
		height = window.innerHeight;
		dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		var densityFactor = width < 900 ? 0.7 : 1;
		var motionFactor = prefersReduced ? 0.4 : 1;
		particleCount = Math.max(15, Math.round(cfg.base * densityFactor * motionFactor));
		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(height * dpr);
		canvas.style.width = width + 'px';
		canvas.style.height = height + 'px';
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		initParticles();
	}

	function initParticles() {
		particles = [];
		for (var i = 0; i < particleCount; i++) {
			particles.push({
				x: Math.random() * width,
				y: Math.random() * height,
				vx: (Math.random() - 0.5) * speed,
				vy: (Math.random() - 0.5) * speed,
				radius: Math.random() * 1.5 + 0.4,
				pulse: Math.random() * Math.PI * 2,
			});
		}
	}

	function drawAura() {
		if (!mouse.active) return;
		var isLight = document.body.classList.contains('theme-light');
		var radius = isLight ? Math.round(cfg.auraRadius * 0.5) : cfg.auraRadius;
		var grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, radius);
		grad.addColorStop(0, isLight ? 'rgba(239, 68, 68, 0.06)' : 'rgba(239, 68, 68, 0.22)');
		grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.arc(mouse.x, mouse.y, radius, 0, Math.PI * 2);
		ctx.fill();
	}

	function animate(now) {
		if (!running) return;
		checkFPS(now || performance.now());

		var isLight = document.body.classList.contains('theme-light');
		ctx.fillStyle = isLight ? 'rgba(249, 250, 251, 0.16)' : 'rgba(2, 1, 6, 0.2)';
		ctx.fillRect(0, 0, width, height);

		var lineColor = isLight ? 'rgba(185, 28, 28, 0.12)' : 'rgba(239, 68, 68, 0.18)';
		var dotColor = isLight ? 'rgba(185, 28, 28, 0.35)' : 'rgba(248, 113, 113, 0.48)';

		drawAura();

		// Update and draw particles
		var i = particles.length;
		while (i--) {
			var p = particles[i];
			p.pulse += 0.018;
			p.x += p.vx;
			p.y += p.vy;

			// Burst particles fade out
			if (p.burst) {
				p.life -= 0.008;
				p.vx *= 0.985;
				p.vy *= 0.985;
				if (p.life <= 0) {
					particles.splice(i, 1);
					continue;
				}
			}

			if (p.x < 0 || p.x > width) p.vx *= -1;
			if (p.y < 0 || p.y > height) p.vy *= -1;

			if (mouse.active) {
				var dx = mouse.x - p.x;
				var dy = mouse.y - p.y;
				var dist = Math.sqrt(dx * dx + dy * dy) || 1;
				if (dist < cfg.mouseRadius) {
					var force = (cfg.mouseRadius - dist) / 2400;
					p.vx -= (dx / dist) * force;
					p.vy -= (dy / dist) * force;
				}
			}

			p.vx *= 0.996;
			p.vy *= 0.996;

			ctx.beginPath();
			ctx.arc(p.x, p.y, p.radius + Math.sin(p.pulse) * 0.28, 0, Math.PI * 2);
			ctx.fillStyle = dotColor;
			ctx.globalAlpha = p.burst ? p.life : 1;
			ctx.fill();
			ctx.globalAlpha = 1;
		}

		// Draw connections (skip for low tier to save budget)
		if (tier !== 'low') {
			for (i = 0; i < particles.length; i++) {
				for (var j = i + 1; j < particles.length; j++) {
					var dx2 = particles[i].x - particles[j].x;
					var dy2 = particles[i].y - particles[j].y;
					var distSq = dx2 * dx2 + dy2 * dy2;
					if (distSq < connectionDistanceSq) {
						ctx.beginPath();
						ctx.moveTo(particles[i].x, particles[i].y);
						ctx.lineTo(particles[j].x, particles[j].y);
						ctx.strokeStyle = lineColor;
						ctx.lineWidth = 0.55;
						ctx.globalAlpha = 1 - (distSq / connectionDistanceSq);
						ctx.stroke();
						ctx.globalAlpha = 1;
					}
				}
			}
		}

		rafId = requestAnimationFrame(animate);
	}

	if (hasFine) {
		window.addEventListener('mousemove', function (e) {
			mouse.x = e.clientX;
			mouse.y = e.clientY;
			mouse.active = true;
		}, { passive: true });
		window.addEventListener('mouseleave', function () {
			mouse.active = false;
		});
	}

	document.addEventListener('visibilitychange', function () {
		if (document.hidden) {
			running = false;
			if (rafId) cancelAnimationFrame(rafId);
		} else if (!running) {
			running = true;
			fpsLast = performance.now();
			fpsFrames = 0;
			animate();
		}
	});

	var resizeTimer;
	window.addEventListener('resize', function () {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(resize, 120);
	});
	resize();
	animate();
})();
