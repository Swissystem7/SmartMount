#!/usr/bin/env node
// Zero-dependency static server for the E2E suite (CT-014). Serves the repo
// root the way GitHub Pages does (directory -> index.html), on 127.0.0.1 only.
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8'
};

function resolve(rawUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(rawUrl, 'http://localhost').pathname);
  } catch (err) {
    return null;
  }
  if (pathname.includes('\0')) return null;
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.resolve(ROOT, '.' + pathname);
  const rel = path.relative(ROOT, file);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  if (/^(\.|node_modules|e2e)/.test(rel.split(path.sep).join('/'))) return null;
  return file;
}

const server = http.createServer(function (req, res) {
  const file = resolve(req.url);
  fs.stat(file || '', function (err, stat) {
    if (!file || err || !stat.isFile()) {
      // Like GitHub Pages: unknown paths get the site's 404 page.
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(path.join(ROOT, '404.html')).pipe(res);
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(file).pipe(res);
  });
});

const port = Number(process.env.PORT) || 4174;
server.listen(port, '127.0.0.1', function () {
  console.log('SmartMount e2e server: http://127.0.0.1:' + port + '/');
});
