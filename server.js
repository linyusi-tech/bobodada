'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const wishesHandler = require('./api/wishes.js');

const ROOT = __dirname;
const DEFAULT_PORT = 8036;

const MIME_TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
	'.mp3': 'audio/mpeg',
	'.m4a': 'audio/mp4',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.eot': 'application/vnd.ms-fontobject'
};

function loadEnvFile(filePath) {
	if (!fs.existsSync(filePath)) return;
	const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
	lines.forEach((line) => {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) return;
		const index = trimmed.indexOf('=');
		if (index === -1) return;
		const key = trimmed.slice(0, index).trim();
		let value = trimmed.slice(index + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		if (key && process.env[key] === undefined) process.env[key] = value;
	});
}

function safePathFromUrl(requestUrl) {
	const url = new URL(requestUrl, 'http://localhost');
	let pathname = decodeURIComponent(url.pathname);
	if (pathname.endsWith('/')) pathname += 'index.html';
	const resolved = path.resolve(ROOT, `.${pathname}`);
	if (!resolved.startsWith(ROOT)) return null;
	return resolved;
}

function serveStatic(req, res) {
	const filePath = safePathFromUrl(req.url);
	if (!filePath) {
		res.writeHead(403);
		res.end('Forbidden');
		return;
	}

	fs.stat(filePath, (statError, stat) => {
		if (statError || !stat.isFile()) {
			res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
			res.end('Not found');
			return;
		}

		const ext = path.extname(filePath).toLowerCase();
		res.writeHead(200, {
			'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
			'Cache-Control': 'no-cache'
		});
		fs.createReadStream(filePath).pipe(res);
	});
}

loadEnvFile(path.join(ROOT, '.env.local'));
loadEnvFile(path.join(ROOT, '.env'));

let nextPort = Number(process.env.PORT || DEFAULT_PORT);

const server = http.createServer((req, res) => {
	if (req.url === '/api/wishes' || req.url.startsWith('/api/wishes?')) {
		wishesHandler(req, res);
		return;
	}
	serveStatic(req, res);
});

function listen(port) {
	nextPort = port;
	server.listen(port, '127.0.0.1');
}

server.on('listening', () => {
	const address = server.address();
	const url = `http://127.0.0.1:${address.port}/`;
	console.log(`Bobo Birthday dev server: ${url}`);
	console.log(`Open locally: ${pathToFileURL(path.join(ROOT, 'index.html')).href}`);
});

server.on('error', (error) => {
	if (error.code === 'EADDRINUSE' && !process.env.PORT && nextPort < DEFAULT_PORT + 10) {
		listen(nextPort + 1);
		return;
	}
	throw error;
});

listen(nextPort);
