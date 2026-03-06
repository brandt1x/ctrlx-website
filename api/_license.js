const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

function getSupabase() {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) return null;
	return createClient(url, key);
}

function generateKey() {
	return crypto.randomBytes(12).toString('base64url');
}

/**
 * Get or create a license key for a payment.
 * Returns the license_key string, or null on failure.
 */
async function getOrCreateLicenseKey({ paymentIntentId, userId, email, productIds }) {
	const supabase = getSupabase();
	if (!supabase) return null;

	const { data: existing } = await supabase
		.from('license_keys')
		.select('license_key')
		.eq('payment_intent_id', paymentIntentId)
		.maybeSingle();

	if (existing && existing.license_key) {
		return existing.license_key;
	}

	const key = generateKey();
	const { error } = await supabase.from('license_keys').insert({
		payment_intent_id: paymentIntentId,
		user_id: userId || null,
		email: email || '',
		license_key: key,
		product_ids: productIds || [],
	});

	if (error) {
		if (error.code === '23505') {
			const { data: retry } = await supabase
				.from('license_keys')
				.select('license_key')
				.eq('payment_intent_id', paymentIntentId)
				.maybeSingle();
			return retry?.license_key || null;
		}
		console.error('Failed to insert license key:', error);
		return null;
	}

	return key;
}

/**
 * Look up an existing license key for a payment intent.
 */
async function getLicenseKey(paymentIntentId) {
	const supabase = getSupabase();
	if (!supabase) return null;
	const { data } = await supabase
		.from('license_keys')
		.select('license_key')
		.eq('payment_intent_id', paymentIntentId)
		.maybeSingle();
	return data?.license_key || null;
}

/**
 * Send the license key to the customer via Resend.
 */
async function sendLicenseEmail(email, licenseKey, productNames) {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey || !email) return false;

	const resend = new Resend(apiKey);
	const productList = (productNames || []).join(', ') || 'your purchased scripts';

	try {
		await resend.emails.send({
			from: 'Control-X <noreply@cntrl-x.com>',
			to: email,
			subject: 'Your Control-X License Key',
			html: `
				<div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0a0a14;color:#f8fafc;border-radius:12px;">
					<h2 style="margin:0 0 8px;font-size:1.4rem;color:#f8fafc;">Your License Key</h2>
					<p style="color:#94a3b8;margin:0 0 24px;font-size:0.95rem;">Use this key to extract your downloaded ZIP file.</p>
					<div style="background:#1e1e2e;border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:16px 20px;text-align:center;margin-bottom:24px;">
						<code style="font-size:1.3rem;letter-spacing:0.08em;color:#ef4444;font-weight:700;">${licenseKey}</code>
					</div>
					<p style="color:#94a3b8;font-size:0.9rem;margin:0 0 8px;"><strong style="color:#f8fafc;">Products:</strong> ${productList}</p>
					<p style="color:#94a3b8;font-size:0.9rem;margin:0 0 8px;"><strong style="color:#f8fafc;">How to use:</strong> Open the downloaded ZIP in WinRAR or 7-Zip, enter the key above when prompted.</p>
					<p style="color:#64748b;font-size:0.82rem;margin:24px 0 0;">This key is unique to your purchase. Do not share it. &mdash; Control-X</p>
				</div>
			`,
		});
		return true;
	} catch (err) {
		console.error('Failed to send license email:', err);
		return false;
	}
}

module.exports = { getOrCreateLicenseKey, getLicenseKey, sendLicenseEmail };
