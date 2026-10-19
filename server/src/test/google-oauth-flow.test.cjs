require('dotenv').config();
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');

describe('Google OAuth & Exchange Token Flows', () => {
  const { app } = require('../../admin-server');
  const { createTokensAndExchangeCode } = require('../services/google-oauth-service');

  let server;
  let baseUrl;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(() => {
    if (server) server.close();
  });

  test('GET /api/auth/google redirects to Google OAuth consent URL with correct callback URI', async () => {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'x-forwarded-host': 'cheri-three.vercel.app',
        'x-forwarded-proto': 'https'
      }
    });

    assert.equal(res.status, 302, 'Should return HTTP 302 Redirect');
    const location = res.headers.get('location') || '';
    assert.ok(location.startsWith('https://accounts.google.com/o/oauth2/v2/auth'), 'Should redirect to Google OAuth URL');
    assert.ok(location.includes('redirect_uri=https%3A%2F%2Fcheri-three.vercel.app%2Fapi%2Fauth%2Fgoogle%2Fcallback'), 'Redirect URI must match Vercel production callback');
    assert.ok(location.includes('response_type=code'), 'Must request authorization code');
    assert.ok(location.includes('scope=openid+email+profile'), 'Must request openid, email and profile scopes');
  });

  test('GET /api/auth/google/callback handles denied error gracefully', async () => {
    const res = await fetch(`${baseUrl}/api/auth/google/callback?error=access_denied`, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'x-forwarded-host': 'cheri-three.vercel.app',
        'x-forwarded-proto': 'https'
      }
    });

    assert.equal(res.status, 302);
    const location = res.headers.get('location') || '';
    assert.ok(location.includes('/vi/authorize/signin?error=oauth_denied'), 'Should redirect to signin with error=oauth_denied');
  });

  test('POST /api/auth/exchange-token successfully exchanges valid code for accessToken & user profile', async () => {
    const fakeUser = {
      _id: '64a1b2c3d4e5f6a7b8c9d0e1',
      email: 'customer@gmail.com',
      roles: ['user'],
      name: 'Nguyen Van A'
    };

    const { exchangeCode } = createTokensAndExchangeCode(jwt, fakeUser, true);

    const res = await fetch(`${baseUrl}/api/auth/exchange-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code: exchangeCode })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.accessToken, 'Must provide JWT access token');
    assert.equal(body.user.email, 'customer@gmail.com');
    assert.equal(body.isNewUser, true);
  });

  test('POST /api/auth/exchange-token rejects invalid or expired code', async () => {
    const res = await fetch(`${baseUrl}/api/auth/exchange-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code: 'malformed_invalid_jwt_token' })
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.error);
  });
});
