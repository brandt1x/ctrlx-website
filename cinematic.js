// Global cinematic particle canvas — runs on all non-ultimate pages
(function () {
	'use strict';

	if (document.body.classList.contains('ultimate-page')) return;

	const canvas = document.getElementById('site-canvas-bg');
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const hasFine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
	const cores = navigator.hardwareConcurrency || 4;

	let particles = [];
	const mouse = { x: -9999, y: -9999, active: false };
	const connectionDistance = 130;
	const connectionDistanceSq = connectionDistance * connectionDistance;
	const speed = 0.32;
	let width = 0;
	let height = 0;
	let rafId = 0;
	let running = true;
	let dpr = 1;
	let particleCount = 65;

	function resize() {
		width = window.innerWidth;
		height = window.innerHeight;
		dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		const densityFactor = width < 900 ? 0.75 : 1;
		const coreFactor = cores <= 4 ? 0.78 : 1;
		const motionFactor = prefersReduced ? 0.5 : 1;
		particleCount = Math.max(30, Math.round(68 * densityFactor * coreFactor * motionFactor));
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
				vx: (Math.random() - 0.5) * speed,
				vy: (Math.random() - 0.5) * speed,
				radius: Math.random() * 1.5 + 0.4,
				pulse: Math.random() * Math.PI * 2,
			});
		}
	}

	function drawAura() {
		if (!mouse.active) return;
		const isLight = document.body.classList.contains('theme-light');
		const radius = isLight ? 70 : 180;
		const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, radius);
		grad.addColorStop(0, isLight ? 'rgba(239, 68, 68, 0.06)' : 'rgba(239, 68, 68, 0.22)');
		grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
		ctx.fillStyle = grad;
		ctx.beginPath();
		ctx.arc(mouse.x, mouse.y, radius, 0, Math.PI * 2);
		ctx.fill();
	}

	function animate() {
		if (!running) return;
		const isLight = document.body.classList.contains('theme-light');
		ctx.fillStyle = isLight ? 'rgba(249, 250, 251, 0.16)' : 'rgba(2, 1, 6, 0.2)';
		ctx.fillRect(0, 0, width, height);

		const lineColor = isLight ? 'rgba(185, 28, 28, 0.12)' : 'rgba(239, 68, 68, 0.18)';
		const dotColor = isLight ? 'rgba(185, 28, 28, 0.35)' : 'rgba(248, 113, 113, 0.48)';

		drawAura();

		for (let i = 0; i < particles.length; i++) {
			const p = particles[i];
			p.pulse += 0.018;
			p.x += p.vx;
			p.y += p.vy;
			if (p.x < 0 || p.x > width) p.vx *= -1;
			if (p.y < 0 || p.y > height) p.vy *= -1;

			if (mouse.active) {
				const dx = mouse.x - p.x;
				const dy = mouse.y - p.y;
				const dist = Math.sqrt(dx * dx + dy * dy) || 1;
				if (dist < 180) {
					const force = (180 - dist) / 2400;
					p.vx -= (dx / dist) * force;
					p.vy -= (dy / dist) * force;
				}
			}

			p.vx *= 0.996;
			p.vy *= 0.996;

			ctx.beginPath();
			ctx.arc(p.x, p.y, p.radius + Math.sin(p.pulse) * 0.28, 0, Math.PI * 2);
			ctx.fillStyle = dotColor;
			ctx.fill();
		}

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
					ctx.lineWidth = 0.55;
					ctx.globalAlpha = 1 - (distSq / connectionDistanceSq);
					ctx.stroke();
					ctx.globalAlpha = 1;
				}
			}
		}

		rafId = requestAnimationFrame(animate);
	}

	if (hasFine) {
		window.addEventListener('mousemove', (e) => {
			mouse.x = e.clientX;
			mouse.y = e.clientY;
			mouse.active = true;
		}, { passive: true });
		window.addEventListener('mouseleave', () => {
			mouse.active = false;
		});
	}

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
	window.addEventListener('resize', () => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(resize, 120);
	});
	resize();
	animate();
})();
