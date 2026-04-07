#!/usr/bin/env node
/**
 * Vercel deployment diagnostic - tests hypotheses for why deploy fails.
 * Run: node scripts/diagnose-vercel.js
 */
const fs = require('fs');
const path = require('path');

const LOG_ENDPOINT = 'http://127.0.0.1:7247/ingest/14e09fd4-ef14-4c17-a7af-1afd0c9a1266';
const LOG_PATH = path.join(__dirname, '..', '.cursor', 'debug.log');

function log(hypothesisId, message, data = {}) {
	const payload = {
		location: 'diagnose-vercel.js',
		message,
		data: { ...data, hypothesisId },
		timestamp: Date.now(),
		hypothesisId,
	};
	// Write to file (NDJSON)
	try {
		fs.appendFileSync(LOG_PATH, JSON.stringify(payload) + '\n');
	} catch (e) {
		console.error('Log write failed:', e.message);
	}
	// Also send via HTTP
	fetch(LOG_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	}).catch(() => {});
}

const rootDir = path.join(__dirname, '..');
const apiDir = path.join(rootDir, 'api');

// Hypothesis A: vercel.json has invalid schema/config
function testVercelJson() {
	try {
		const vercelPath = path.join(rootDir, 'vercel.json');
		if (!fs.existsSync(vercelPath)) {
			log('A', 'vercel.json missing', { exists: false });
			return false;
		}
		const raw = fs.readFileSync(vercelPath, 'utf8');
		const parsed = JSON.parse(raw);
		log('A', 'vercel.json parsed OK', { keys: Object.keys(parsed), functions: parsed.functions ? Object.keys(parsed.functions) : [] });
		return true;
	} catch (e) {
		log('A', 'vercel.json invalid', { error: e.message });
		return false;
	}
}

// Hypothesis B: API dependencies fail to load
function testApiRequires() {
	const apiFiles = [
		'auth-helpers.js',
		'create-checkout-session.js',
		'download-vision-x.js',
		'download-script.js',
		'download-all-scripts.js',
		'items-utils.js',
		'my-purchases.js',
		'stripe-webhook.js',
		'supabase-config.js',
		'verify-session.js',
	];
	const results = [];
	for (const file of apiFiles) {
		const fullPath = path.join(apiDir, file);
		if (!fs.existsSync(fullPath)) {
			results.push({ file, ok: false, error: 'not found' });
			continue;
		}
		try {
			const modPath = path.join(apiDir, file);
			require(modPath);
			results.push({ file, ok: true });
		} catch (e) {
			results.push({ file, ok: false, error: e.message });
		}
	}
	const failed = results.filter((r) => !r.ok);
	log('B', failed.length ? 'API require failures' : 'All API files load OK', { results, failedCount: failed.length });
	return failed.length === 0;
}

// Hypothesis C: package.json / npm install would succeed
function testPackageJson() {
	try {
		const pkgPath = path.join(rootDir, 'package.json');
		const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
		const deps = Object.keys(pkg.dependencies || {});
		const nodeModules = path.join(rootDir, 'node_modules');
		const missing = deps.filter((d) => !fs.existsSync(path.join(nodeModules, d)));
		log('C', missing.length ? 'Missing node_modules' : 'Dependencies present', { deps, missing });
		return missing.length === 0;
	} catch (e) {
		log('C', 'package.json error', { error: e.message });
		return false;
	}
}

// Hypothesis D: Vercel CLI build (if available)
function testVercelBuild() {
	try {
		const { execSync } = require('child_process');
		const out = execSync('npx vercel build --yes 2>&1', {
			cwd: rootDir,
			encoding: 'utf8',
			timeout: 90000,
		});
		log('D', 'vercel build succeeded', { outputLength: out.length });
	} catch (e) {
		log('D', 'vercel build failed or CLI missing', {
			error: e.message,
			stderr: e.stderr ? String(e.stderr).slice(0, 800) : undefined,
			stdout: e.stdout ? String(e.stdout).slice(0, 800) : undefined,
		});
	}
}

function main() {
	const cursorDir = path.join(rootDir, '.cursor');
	if (!fs.existsSync(cursorDir)) {
		fs.mkdirSync(cursorDir, { recursive: true });
	}
	log('_init', 'Diagnostic started', { cwd: process.cwd() });

	testVercelJson();
	testApiRequires();
	testPackageJson();
	testVercelBuild();

	log('_done', 'Diagnostic complete', {});
	console.log('Diagnostic complete. Check .cursor/debug.log for results.');
}

try {
	main();
} catch (e) {
	log('_error', 'Diagnostic crashed', { error: e.message });
	console.error(e);
	process.exit(1);
}
