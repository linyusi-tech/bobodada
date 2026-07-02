'use strict';

const { submitWish, normalizeWish } = require('../lib/feishu-wishes.cjs');

const DEFAULT_ALLOWED_ORIGINS = [
	'https://bobodada.cn',
	'https://www.bobodada.cn',
	'http://127.0.0.1:8036',
	'http://localhost:8036',
	'http://127.0.0.1:8037',
	'http://localhost:8037'
];

function getAllowedOrigins() {
	const raw = process.env.WISH_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(',');
	const allowed = raw.split(',').map((item) => item.trim()).filter(Boolean);
	if (process.env.VERCEL_URL) {
		allowed.push(`https://${process.env.VERCEL_URL}`);
	}
	return allowed;
}

function resolveCorsOrigin(req) {
	const origin = req.headers.origin;
	const allowed = getAllowedOrigins();
	if (!origin) return '*';
	if (/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) return origin;
	if (allowed.includes('*') || allowed.includes(origin)) return origin;
	return '';
}

function setCors(req, res) {
	const origin = resolveCorsOrigin(req);
	if (origin) {
		res.setHeader('Access-Control-Allow-Origin', origin);
		res.setHeader('Vary', 'Origin');
	}
	res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, payload) {
	res.statusCode = statusCode;
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.end(JSON.stringify(payload));
}

function parseBody(req) {
	if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
	if (typeof req.body === 'string') {
		try {
			return Promise.resolve(JSON.parse(req.body));
		} catch (error) {
			return Promise.reject(new Error('Invalid JSON body'));
		}
	}

	return new Promise((resolve, reject) => {
		let body = '';
		req.on('data', (chunk) => {
			body += chunk;
			if (body.length > 16384) {
				reject(new Error('Request body too large'));
				req.destroy();
			}
		});
		req.on('end', () => {
			try {
				resolve(body ? JSON.parse(body) : {});
			} catch (error) {
				reject(new Error('Invalid JSON body'));
			}
		});
		req.on('error', reject);
	});
}

module.exports = async function wishesHandler(req, res) {
	setCors(req, res);

	if (req.method === 'OPTIONS') {
		res.statusCode = resolveCorsOrigin(req) ? 204 : 403;
		res.end();
		return;
	}

	if (!resolveCorsOrigin(req)) {
		sendJson(res, 403, { ok: false, error: 'Origin is not allowed' });
		return;
	}

	if (req.method !== 'POST') {
		sendJson(res, 405, { ok: false, error: 'Method not allowed' });
		return;
	}

	try {
		const body = await parseBody(req);
		const wish = normalizeWish(body.wish);
		if (!wish) {
			sendJson(res, 400, { ok: false, error: '愿望不能为空' });
			return;
		}
		const result = await submitWish({
			wish,
			metadata: {
				source: body.source || 'birthday-site',
				page: body.page || req.headers.referer || ''
			}
		});
		sendJson(res, 200, { ok: true, result });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		sendJson(res, statusCode, {
			ok: false,
			error: error.message || 'Failed to save wish'
		});
	}
};
