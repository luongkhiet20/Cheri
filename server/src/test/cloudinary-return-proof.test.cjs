require('dotenv').config();
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');

describe('Cloudinary Return Proof Image Upload & Normalization', () => {
  const { app } = require('../../admin-server');
  const {
    getCloudinaryConfig,
    generateReturnUploadSignature,
    normalizeReturnProofImages,
    deleteCloudinaryAsset,
    isCloudinaryUrl
  } = require('../services/cloudinary-service');

  let server;
  let baseUrl;
  let sampleUploadedPublicId = null;

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

  after(async () => {
    if (server) server.close();
    if (sampleUploadedPublicId) {
      await deleteCloudinaryAsset(sampleUploadedPublicId);
    }
  });

  test('Cloudinary configuration is valid and active', () => {
    const config = getCloudinaryConfig();
    assert.equal(config.isConfigured, true, 'Cloudinary must be configured with valid credentials');
    assert.ok(config.cloudName, 'Must have cloudName');
    assert.ok(config.apiKey, 'Must have apiKey');
    assert.ok(config.apiSecret, 'Must have apiSecret');
  });

  test('generateReturnUploadSignature generates valid signature with folder cheri/return-proofs', () => {
    const sigData = generateReturnUploadSignature();
    assert.ok(sigData.signature, 'Must have signature string');
    assert.ok(sigData.timestamp, 'Must have timestamp');
    assert.equal(sigData.folder, 'cheri/return-proofs', 'Folder must be cheri/return-proofs');
    assert.ok(sigData.cloudName, 'Must include cloudName for client upload');
    assert.ok(sigData.apiKey, 'Must include apiKey for client upload');
  });

  test('GET /api/orders/return-upload-signature rejects unauthenticated request with 401', async () => {
    const res = await fetch(`${baseUrl}/api/orders/return-upload-signature`, {
      method: 'GET'
    });
    assert.equal(res.status, 401, 'Should return HTTP 401 Unauthorized');
  });

  test('GET /api/orders/return-upload-signature returns signature when authenticated', async () => {
    const token = jwt.sign(
      { id: '64a1b2c3d4e5f6a7b8c9d0e1', email: 'test@example.com', roles: ['user'] },
      process.env.JWT_SECRET || 'dev_jwt_secret_eshop_123456789'
    );

    const res = await fetch(`${baseUrl}/api/orders/return-upload-signature`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    assert.equal(res.status, 200, 'Should return HTTP 200');
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.signature, 'Signature must be returned');
    assert.equal(json.folder, 'cheri/return-proofs');
  });

  test('normalizeReturnProofImages handles legacy URLs, Base64 uploads, and existing Cloudinary URLs', async () => {
    // 1. URL legacy
    const legacyUrl = 'https://static.wixstatic.com/media/sample_product.webp';
    // 2. Local uploads path legacy
    const localUploadPath = '/uploads/returns/return_legacy_sample.jpg';
    // 3. Small 1x1 PNG data URI for real upload test
    const tinyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const inputImages = [legacyUrl, localUploadPath, tinyBase64];
    const normalized = await normalizeReturnProofImages(inputImages);

    assert.equal(normalized.length, 3, 'Must return 3 normalized URLs');
    assert.equal(normalized[0], legacyUrl, 'Legacy external URL must be preserved');
    assert.equal(normalized[1], localUploadPath, 'Legacy local upload path must be preserved');
    assert.ok(normalized[2].startsWith('https://res.cloudinary.com/'), 'Base64 must be converted to Cloudinary HTTPS URL');
    assert.ok(normalized[2].includes('/cheri/return-proofs/'), 'URL must be in folder cheri/return-proofs');

    // Extract public_id for cleanup
    const match = normalized[2].match(/(cheri\/return-proofs\/[^.]+)/);
    if (match) {
      sampleUploadedPublicId = match[1];
    }
  });

  test('isCloudinaryUrl correctly identifies Cloudinary URLs', () => {
    assert.equal(isCloudinaryUrl('https://res.cloudinary.com/uc6ulx9i/image/upload/v123/img.jpg'), true);
    assert.equal(isCloudinaryUrl('http://res.cloudinary.com/uc6ulx9i/image/upload/v123/img.jpg'), true);
    assert.equal(isCloudinaryUrl('https://static.wixstatic.com/media/sample.webp'), false);
    assert.equal(isCloudinaryUrl('/uploads/returns/return_123.png'), false);
    assert.equal(isCloudinaryUrl('data:image/png;base64,abc'), false);
  });
});
