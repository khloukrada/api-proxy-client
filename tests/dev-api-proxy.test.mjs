import assert from 'node:assert/strict';
import { test, mock, afterEach, beforeEach } from 'node:test';

import { GET, POST, PATCH, DELETE } from '../src/app/api/backend/[...path]/route.ts';

const originalEnvironment = { ...process.env };
const origin = 'http://localhost:8083';
const context = (path) => ({ params: Promise.resolve({ path: path.split('/') }) });
const request = (path, init = {}) => new Request(`${origin}/api/backend/${path}`, init);

beforeEach(() => {
  process.env.NODE_ENV = 'development';
  process.env.DEV_API_PROXY_URL = 'https://backend.example';
});

afterEach(() => {
  process.env = { ...originalEnvironment };
  mock.restoreAll();
});

test('CSRF cookie, login, session read, and logout preserve the cookie authentication flow', async () => {
  const upstream = mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url.origin, 'https://backend.example');
    assert.equal(init.headers.get('referer'), `${origin}/`);
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'manual');

    if (url.pathname === '/sanctum/csrf-cookie') {
      const headers = new Headers();
      headers.append(
        'Set-Cookie',
        'XSRF-TOKEN=csrf%3D; Domain=.backend.example; Path=/; Secure; SameSite=Lax'
      );
      headers.append(
        'Set-Cookie',
        'session=before; Expires=Wed, 01 Dec 2027 00:00:00 GMT; Domain=.backend.example; Path=/; Secure; HttpOnly; SameSite=Lax'
      );
      return new Response(null, { status: 204, headers });
    }

    assert.equal(init.headers.get('cookie'), 'XSRF-TOKEN=csrf%3D; session=before');
    if (url.pathname === '/api/me') {
      return Response.json({ user: { id: 1 } });
    }

    assert.equal(init.headers.get('origin'), origin);
    if (init.headers.get('x-xsrf-token') !== 'csrf=') {
      return Response.json({ message: 'CSRF token mismatch.' }, { status: 419 });
    }
    if (url.pathname === '/login') {
      assert.deepEqual(JSON.parse(new TextDecoder().decode(init.body)), {
        email: 'admin@example.test',
        password: 'test',
      });
    }
    return new Response(null, {
      status: 204,
      headers: { 'Set-Cookie': 'session=rotated; Secure; HttpOnly; Path=/' },
    });
  });

  const csrf = await GET(request('sanctum/csrf-cookie'), context('sanctum/csrf-cookie'));
  assert.equal(csrf.status, 204);
  const cookies = csrf.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.match(cookies[1], /Expires=Wed, 01 Dec 2027 00:00:00 GMT/);
  assert.match(cookies[1], /HttpOnly/);
  assert.doesNotMatch(cookies[0], /HttpOnly/);
  for (const cookie of cookies) {
    assert.doesNotMatch(cookie, /Domain=|; Secure/i);
    assert.match(cookie, /SameSite=Lax; Path=\/$/);
  }

  const headers = {
    Origin: origin,
    Cookie: cookies.map((cookie) => cookie.split(';')[0]).join('; '),
    'Content-Type': 'application/json',
  };
  const body = JSON.stringify({ email: 'admin@example.test', password: 'test' });
  const missingCsrf = await POST(
    request('login', { method: 'POST', headers, body }),
    context('login')
  );
  assert.equal(missingCsrf.status, 419);
  assert.equal((await missingCsrf.json()).message, 'CSRF token mismatch.');

  headers['X-XSRF-TOKEN'] = 'csrf=';
  const login = await POST(request('login', { method: 'POST', headers, body }), context('login'));
  assert.equal(login.status, 204);
  assert.match(login.headers.getSetCookie()[0], /session=rotated; HttpOnly/);
  const me = await GET(request('api/me', { headers }), context('api/me'));
  assert.deepEqual(await me.json(), { user: { id: 1 } });
  assert.equal(
    (await POST(request('logout', { method: 'POST', headers }), context('logout'))).status,
    204
  );
  assert.equal(upstream.mock.callCount(), 5);
});

test('keeps dashboard methods, query strings, JSON errors, and rate-limit headers', async () => {
  mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url.pathname, '/api/admin/tokens/123');
    assert.equal(url.search, '?page=2');
    assert.ok(['PATCH', 'DELETE'].includes(init.method));
    return Response.json(
      { message: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  });
  for (const [method, handler] of [
    ['PATCH', PATCH],
    ['DELETE', DELETE],
  ]) {
    const response = await handler(
      request('api/admin/tokens/123?page=2', { method }),
      context('api/admin/tokens/123')
    );
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '60');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { message: 'Too many requests.' });
  }
});

test('is disabled in production and when no upstream is configured', async () => {
  const upstream = mock.method(globalThis, 'fetch', () =>
    assert.fail('Unexpected upstream request')
  );
  process.env.NODE_ENV = 'production';
  assert.equal((await GET(request('api/me'), context('api/me'))).status, 404);
  process.env.NODE_ENV = 'development';
  delete process.env.DEV_API_PROXY_URL;
  assert.equal((await GET(request('api/me'), context('api/me'))).status, 404);
  assert.equal(upstream.mock.callCount(), 0);
});

test('rejects remote hosts, foreign origins, and paths outside the API before forwarding', async () => {
  mock.method(globalThis, 'fetch', () => assert.fail('Unexpected upstream request'));
  for (const untrusted of [
    new Request('http://admin.example/api/backend/api/me'),
    request('api/me', { headers: { Origin: 'https://foreign.example' } }),
    request('api/me', { headers: { Referer: 'http://localhost:8083.foreign.example/' } }),
    request('api/me', { headers: { 'Sec-Fetch-Site': 'cross-site' } }),
  ]) {
    assert.equal((await GET(untrusted, context('api/me'))).status, 403);
  }
  for (const path of ['.env', 'api/../secret', 'api//foreign.example', 'api/\\secret']) {
    assert.equal((await GET(request('api/me'), context(path))).status, 404);
  }
});

test('does not follow upstream redirects or expose connectivity errors', async () => {
  const upstream = mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(null, { status: 302, headers: { Location: 'https://foreign.example' } })
  );
  const redirect = await GET(request('api/me'), context('api/me'));
  assert.equal(redirect.status, 502);
  assert.equal(redirect.headers.get('location'), null);
  upstream.mock.mockImplementation(async () => {
    throw new Error('Internal connection details');
  });
  const unavailable = await GET(request('api/me'), context('api/me'));
  assert.equal(unavailable.status, 502);
  assert.doesNotMatch(await unavailable.text(), /Internal connection details/);
});
