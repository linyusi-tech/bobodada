'use strict';

const FEISHU_API = 'https://open.feishu.cn/open-apis';
const DEFAULT_WISH_DOC_URL = '';
const DEFAULT_WISH_WIKI_TOKEN = '';

function getEnv(name, fallback) {
	const value = process.env[name];
	return value === undefined || value === '' ? fallback : value;
}

function getWishDocUrl() {
	return getEnv('FEISHU_WISH_DOC_URL', DEFAULT_WISH_DOC_URL);
}

function getWikiToken() {
	const explicit = getEnv('FEISHU_WISH_WIKI_TOKEN', '');
	if (explicit) return explicit;
	const match = getWishDocUrl().match(/\/wiki\/([^/?#]+)/);
	return match ? match[1] : DEFAULT_WISH_WIKI_TOKEN;
}

function normalizeWish(value) {
	return String(value || '')
		.replace(/\r\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
		.slice(0, 800);
}

function formatShanghaiTime(date) {
	return new Intl.DateTimeFormat('zh-CN', {
		timeZone: 'Asia/Shanghai',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	}).format(date);
}

async function readJsonResponse(response, label) {
	const text = await response.text();
	let data = {};
	if (text) {
		try {
			data = JSON.parse(text);
		} catch (error) {
			throw new Error(`${label} returned non-JSON: ${text.slice(0, 300)}`);
		}
	}
	if (!response.ok || (data.code !== undefined && data.code !== 0)) {
		const message = data.msg || data.message || response.statusText || 'Unknown Feishu error';
		throw new Error(`${label} failed: ${message}`);
	}
	return data;
}

async function feishuFetch(path, options) {
	const response = await fetch(`${FEISHU_API}${path}`, {
		...options,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			...(options && options.headers ? options.headers : {})
		}
	});
	return readJsonResponse(response, options && options.label ? options.label : path);
}

async function getTenantAccessToken() {
	const appId = getEnv('FEISHU_APP_ID', getEnv('LARK_APP_ID', ''));
	const appSecret = getEnv('FEISHU_APP_SECRET', getEnv('LARK_APP_SECRET', ''));
	if (!appId || !appSecret) {
		throw new Error('Missing FEISHU_APP_ID and FEISHU_APP_SECRET');
	}

	const data = await feishuFetch('/auth/v3/tenant_access_token/internal', {
		method: 'POST',
		body: JSON.stringify({
			app_id: appId,
			app_secret: appSecret
		}),
		label: 'Feishu tenant access token'
	});

	return data.tenant_access_token;
}

async function resolveWishDocument(tenantAccessToken) {
	const directDocToken = getEnv('FEISHU_WISH_DOC_TOKEN', getEnv('FEISHU_WISH_DOCUMENT_ID', ''));
	if (directDocToken) {
		return {
			objToken: directDocToken,
			objType: getEnv('FEISHU_WISH_DOC_TYPE', 'docx')
		};
	}

	const wikiToken = getWikiToken();
	if (!wikiToken) {
		throw new Error('Missing FEISHU_WISH_DOC_URL or FEISHU_WISH_WIKI_TOKEN');
	}
	const data = await feishuFetch(`/wiki/v2/spaces/get_node?token=${encodeURIComponent(wikiToken)}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${tenantAccessToken}`
		},
		label: 'Feishu wiki node lookup'
	});
	const node = data.data && data.data.node;
	if (!node || !node.obj_token) {
		throw new Error('Could not resolve Feishu wiki node to a document token');
	}
	return {
		objToken: node.obj_token,
		objType: node.obj_type || 'docx'
	};
}

function textBlock(content) {
	return {
		block_type: 2,
		text: {
			elements: [
				{
					text_run: {
						content,
						text_element_style: {}
					}
				}
			],
			style: {}
		}
	};
}

async function appendWishToDocx(tenantAccessToken, documentId, wish, metadata) {
	const blockId = getEnv('FEISHU_WISH_PARENT_BLOCK_ID', documentId);
	const createdAt = formatShanghaiTime(new Date());
	const source = metadata && metadata.source ? `｜${metadata.source}` : '';
	const page = metadata && metadata.page ? `\n页面：${metadata.page}` : '';
	const content = `生日愿望｜${createdAt}${source}\n${wish}${page}`;

	const data = await feishuFetch(`/docx/v1/documents/${encodeURIComponent(documentId)}/blocks/${encodeURIComponent(blockId)}/children`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${tenantAccessToken}`
		},
		body: JSON.stringify({
			index: -1,
			children: [textBlock(content)]
		}),
		label: 'Feishu docx append wish'
	});

	return data.data || data;
}

async function submitWish(payload) {
	const wish = normalizeWish(payload && payload.wish);
	if (!wish) {
		const error = new Error('Wish is empty');
		error.statusCode = 400;
		throw error;
	}

	if (getEnv('FEISHU_WISH_DRY_RUN', '') === '1') {
		return {
			dryRun: true,
			wish,
			docUrl: getWishDocUrl()
		};
	}

	const tenantAccessToken = await getTenantAccessToken();
	const document = await resolveWishDocument(tenantAccessToken);
	if (document.objType !== 'docx') {
		throw new Error(`Unsupported Feishu document type "${document.objType}". Please use a Docx document or set FEISHU_WISH_DOC_TOKEN to a docx token.`);
	}

	return appendWishToDocx(tenantAccessToken, document.objToken, wish, payload && payload.metadata);
}

module.exports = {
	submitWish,
	normalizeWish,
	getWishDocUrl
};
