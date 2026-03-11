/**
 * Simple rate limiting. Uses Upstash Redis if configured; otherwise in-memory (per-instance).
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for distributed rate limiting.
 */

const RATE_LIMITS = {
	checkout: { max: 10, windowSec: 60 },
	download: { max: 30, windowSec: 60 },
};

// In-memory fallback (per serverless instance; resets on cold start)
const memoryStore = new Map();

function cleanupMemoryStore() {
	const now = Date.now();
	for (const [key, timestamps] of memoryStore.entries()) {
		const windowStart = now - 120 * 1000; // 2 min max window
		const filtered = timestamps.filter(t => t > windowStart);
		if (filtered.length === 0) memoryStore.delete(key);
		else memoryStore.set(key, filtered);
	}
}

async function checkMemoryLimit(identifier, limit) {
	cleanupMemoryStore();
	const now = Date.now();
	const windowStart = now - limit.windowSec * 1000;
	let timestamps = memoryStore.get(identifier) || [];
	timestamps = timestamps.filter(t => t > windowStart);
	timestamps.push(now);
	memoryStore.set(identifier, timestamps);
	return timestamps.length <= limit.max;
}

async function checkUpstashLimit(identifier, limit) {
	try {
		const { Ratelimit } = require('@upstash/ratelimit');
		const { Redis } = require('@upstash/redis');
		const redis = new Redis({
			url: process.env.UPSTASH_REDIS_REST_URL,
			token: process.env.UPSTASH_REDIS_REST_TOKEN,
		});
		const ratelimit = new Ratelimit({
			redis,
			limiter: Ratelimit.slidingWindow(limit.max, `${limit.windowSec} s`),
		});
		const { success } = await ratelimit.limit(identifier);
		return success;
	} catch (err) {
		// Fall back to in-memory if Upstash not configured or packages missing
		return checkMemoryLimit(identifier, limit);
	}
}

function getClientIdentifier(req) {
	const forwarded = req.headers['x-forwarded-for'];
	const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers['x-real-ip'] || 'unknown';
	return ip;
}

/**
 * Check rate limit for an endpoint. Returns true if allowed, false if rate limited.
 */
async function checkRateLimit(req, endpoint) {
	const limit = RATE_LIMITS[endpoint];
	if (!limit) return true;
	const identifier = `${endpoint}:${getClientIdentifier(req)}`;
	const useUpstash = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
	const allowed = useUpstash
		? await checkUpstashLimit(identifier, limit)
		: await checkMemoryLimit(identifier, limit);
	return allowed;
}

module.exports = { checkRateLimit, RATE_LIMITS };
