const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

test('Facebook OAuth Configuration & Environment', () => {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  assert.ok(appId, 'FACEBOOK_APP_ID must be present in .env');
  assert.equal(appId, '2602642513490929', 'App ID should match configured Facebook App');
  assert.ok(appSecret, 'FACEBOOK_APP_SECRET must be present in .env');
  assert.notEqual(appId, appSecret, 'FACEBOOK_APP_SECRET must never equal FACEBOOK_APP_ID');
  assert.equal(appSecret.length, 32, 'Facebook App Secret is expected to be a 32-character hex string');
});

test('Facebook Strategy Scopes & Profile Fields Logic', () => {
  const FacebookStrategy = require('passport-facebook').Strategy;
  const serverUrl = (process.env.SERVER_URL || 'http://localhost:4000').replace(/\/+$/, '');

  const strategy = new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: `${serverUrl}/api/auth/facebook/callback`,
      scope: ['email', 'public_profile'],
      profileFields: ['id', 'displayName', 'name', 'photos', 'email'],
      graphAPIVersion: 'v20.0',
    },
    (accessToken, refreshToken, profile, done) => {
      done(null, profile);
    }
  );

  assert.equal(strategy.name, 'facebook');
  assert.equal(strategy._oauth2._clientId, process.env.FACEBOOK_APP_ID);
  assert.equal(strategy._oauth2._clientSecret, process.env.FACEBOOK_APP_SECRET);
  assert.ok(strategy._oauth2._authorizeUrl.includes('/v20.0/dialog/oauth'), 'Authorize URL should use modern Graph API v20.0');
  assert.ok(strategy._oauth2._accessTokenUrl.includes('/v20.0/oauth/access_token'), 'Token URL should use modern Graph API v20.0');

  // Verify profile fields conversion
  const convertedFields = strategy._convertProfileFields(strategy._profileFields);
  assert.ok(convertedFields.includes('email'), 'Fields must include email');
  assert.ok(convertedFields.includes('picture'), 'Fields must map photos to picture');
  assert.ok(!convertedFields.includes('gender'), 'Fields must not request gender without user_gender permission');
});

test('Facebook Profile validation logic', () => {
  // Test 1: Full profile with email
  const mockProfileWithEmail = {
    id: 'fb_123456789',
    displayName: 'Nguyen Van A',
    emails: [{ value: 'nguyenvana@gmail.com' }],
    photos: [{ value: 'https://example.com/photo.jpg' }],
    _json: { email: 'nguyenvana@gmail.com' },
  };

  const emails1 = mockProfileWithEmail.emails || [];
  const email1 =
    emails1.find((mail) => mail?.value)?.value ||
    emails1[0]?.value ||
    mockProfileWithEmail._json?.email ||
    '';
  assert.equal(email1, 'nguyenvana@gmail.com');

  // Test 2: Profile where email is in _json only
  const mockProfileJsonEmail = {
    id: 'fb_987654321',
    displayName: 'Tran Thi B',
    emails: [],
    _json: { email: 'tranthib@gmail.com' },
  };
  const emails2 = mockProfileJsonEmail.emails || [];
  const email2 =
    emails2.find((mail) => mail?.value)?.value ||
    emails2[0]?.value ||
    mockProfileJsonEmail._json?.email ||
    '';
  assert.equal(email2, 'tranthib@gmail.com');

  // Test 3: Profile without email (user refused or phone-only Facebook)
  const mockProfileNoEmail = {
    id: 'fb_000111222',
    displayName: 'Le Van C',
    emails: [],
    _json: {},
  };
  const emails3 = mockProfileNoEmail.emails || [];
  const email3 =
    emails3.find((mail) => mail?.value)?.value ||
    emails3[0]?.value ||
    mockProfileNoEmail._json?.email ||
    '';
  assert.equal(email3, '', 'Should result in empty email string for safe handling');
});

test('Facebook OAuth endpoint redirection & scopes', async () => {
  const http = require('http');

  const checkEndpoint = () => {
    return new Promise((resolve, reject) => {
      const req = http.get('http://localhost:4000/api/auth/facebook', (res) => {
        resolve({
          statusCode: res.statusCode,
          location: res.headers.location,
        });
      });
      req.on('error', reject);
    });
  };

  const response = await checkEndpoint();
  assert.equal(response.statusCode, 302, 'Should return 302 redirect');
  assert.ok(response.location, 'Location header must be present');

  const parsedUrl = new URL(response.location);
  assert.equal(parsedUrl.hostname, 'www.facebook.com');
  assert.ok(parsedUrl.pathname.includes('/dialog/oauth'));
  assert.equal(parsedUrl.searchParams.get('client_id'), '2602642513490929');
  assert.equal(parsedUrl.searchParams.get('redirect_uri'), 'http://localhost:4000/api/auth/facebook/callback');
  assert.equal(parsedUrl.searchParams.get('scope'), 'email,public_profile');
  assert.equal(parsedUrl.searchParams.get('response_type'), 'code');
});
