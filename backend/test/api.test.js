'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { S3Client } = require('@aws-sdk/client-s3');
const { loadConfig } = require('../src/config');
const { createApp } = require('../src/app');

const ORIGIN = 'http://localhost:8080';
const baseEnv = {
  AWS_REGION: 'us-east-1',
  S3_BUCKET: 'bucket-de-prueba',
  CORS_ORIGINS: `${ORIGIN},http://localhost:3000`,
  PORT: '0',
};

// S3 falso: firma local con credenciales falsas; send() no toca la red.
function fakeS3(sent) {
  const client = new S3Client({
    region: 'us-east-1',
    credentials: { accessKeyId: 'TESTKEY', secretAccessKey: 'TESTSECRET' },
  });
  client.send = async (cmd) => {
    sent.push(cmd);
    if (cmd.constructor.name === 'ListObjectsV2Command') {
      return {
        IsTruncated: false,
        Contents: [
          { Key: 'originales/', Size: 0, LastModified: new Date(0) },
          { Key: 'originales/1-ab-foto.png', Size: 123, LastModified: new Date(0) },
        ],
      };
    }
    return {};
  };
  return client;
}

async function start(envOverrides = {}) {
  const sent = [];
  const config = loadConfig({ ...baseEnv, ...envOverrides });
  const app = createApp({ s3: fakeS3(sent), config });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return { server, sent, url: `http://127.0.0.1:${server.address().port}` };
}

const post = (url, body, headers = {}) =>
  fetch(`${url}/api/upload-url`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const valid = { filename: 'foto 1.png', contentType: 'image/png', sizeBytes: 1000 };

let ctx;
before(async () => {
  ctx = await start();
});
after(() => ctx.server.close());

test('config falla al arrancar si falta una variable o hay "*"', () => {
  assert.throws(() => loadConfig({ ...baseEnv, S3_BUCKET: '' }), /S3_BUCKET/);
  assert.throws(() => loadConfig({ ...baseEnv, AWS_REGION: undefined }), /AWS_REGION/);
  assert.throws(() => loadConfig({ ...baseEnv, CORS_ORIGINS: '*' }), /CORS_ORIGINS/);
});

test('health responde 200', async () => {
  const res = await fetch(`${ctx.url}/health`);
  assert.equal(res.status, 200);
});

test('tipo inválido, tamaño excedido y body incompleto -> 400', async () => {
  for (const body of [
    { ...valid, contentType: 'application/x-msdownload' },
    { ...valid, sizeBytes: 10 * 1024 * 1024 },
    { ...valid, sizeBytes: 0 },
    { ...valid, sizeBytes: 1.5 },
    { filename: 'a.png' },
    {},
    { ...valid, filename: '' },
  ]) {
    const res = await post(ctx.url, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    const json = await res.json();
    assert.ok(json.error);
    assert.equal(json.stack, undefined);
  }
  assert.equal((await post(ctx.url, '{no-json')).status, 400);
});

test('caso válido -> 200, X-Amz-Expires=300, ContentLength y ContentType firmados', async () => {
  const res = await post(ctx.url, valid);
  assert.equal(res.status, 200);
  const { uploadUrl, key } = await res.json();
  assert.match(key, /^originales\/\d+-[0-9a-f]{16}-foto_1\.png$/);
  const u = new URL(uploadUrl);
  assert.equal(u.searchParams.get('X-Amz-Expires'), '300');
  const signed = u.searchParams.get('X-Amz-SignedHeaders').split(';');
  assert.ok(signed.includes('content-length'), signed.join());
  assert.ok(signed.includes('content-type'), signed.join());
  assert.ok(!signed.includes('x-amz-server-side-encryption'), 'no debe firmarse el cifrado');
  assert.ok(!uploadUrl.includes('x-amz-server-side-encryption'));
});

test('GET /api/images -> URLs con X-Amz-Expires=900 y sin la carpeta vacía', async () => {
  const res = await fetch(`${ctx.url}/api/images`);
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.equal(list.length, 1);
  assert.equal(list[0].key, 'originales/1-ab-foto.png');
  assert.equal(list[0].size, 123);
  assert.equal(new URL(list[0].url).searchParams.get('X-Amz-Expires'), '900');
});

test('DELETE con key inválida -> 400; válida -> 200', async () => {
  const del = (k) => fetch(`${ctx.url}/api/images/${k}`, { method: 'DELETE' });
  const before = ctx.sent.length;
  for (const k of ['otra/foto.png', 'foto.png', 'originales/../secreto.png', 'originales/%2e%2e/x', '..%2Foriginales%2Fa.png', 'originales/a//b.png']) {
    assert.equal((await del(k)).status, 400, k);
  }
  assert.equal(ctx.sent.length, before, 'no debe llegar nada a S3');
  const ok = await del('originales/1-ab-foto.png');
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { deleted: true });
  const last = ctx.sent.at(-1);
  assert.equal(last.constructor.name, 'DeleteObjectCommand');
  assert.equal(last.input.Key, 'originales/1-ab-foto.png');
});

test('validateKey rechaza segmentos "." y vacíos', () => {
  const { validateKey } = require('../src/validation');
  for (const k of ['originales/./x.png', 'originales/a/./b.png', 'originales//x.png', 'originales/x/']) {
    assert.throws(() => validateKey(k), /inválida/, k);
  }
  assert.equal(validateKey('originales/sub/ok.png'), 'originales/sub/ok.png');
});

test('CORS limitado a CORS_ORIGINS', async () => {
  const ok = await fetch(`${ctx.url}/health`, { headers: { Origin: ORIGIN } });
  assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN);
  const bad = await fetch(`${ctx.url}/health`, { headers: { Origin: 'http://evil.example' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
  assert.notEqual(ok.headers.get('access-control-allow-origin'), '*');
});

test('rate limit en /api/upload-url -> 429', async () => {
  const c = await start();
  try {
    const limit = c.server && loadConfig(baseEnv).uploadRateLimit.limit;
    let last;
    for (let i = 0; i <= limit; i++) last = await post(c.url, valid);
    assert.equal(last.status, 429);
  } finally {
    c.server.close();
  }
});
