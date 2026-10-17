const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();

const {
  ALLOWED_FOLDERS,
  generateUploadSignature,
  normalizeProductImages,
  normalizeSettingsImages,
  isCloudinaryUrl
} = require('../services/cloudinary-service');

test('Cloudinary Shared Service - Functional Folders Whitelist', () => {
  assert.equal(ALLOWED_FOLDERS.length, 5);
  assert.ok(ALLOWED_FOLDERS.includes('cheri/avatars'));
  assert.ok(ALLOWED_FOLDERS.includes('cheri/return-proofs'));
  assert.ok(ALLOWED_FOLDERS.includes('cheri/products'));
  assert.ok(ALLOWED_FOLDERS.includes('cheri/cms'));
  assert.ok(ALLOWED_FOLDERS.includes('cheri/settings'));
});

test('Cloudinary Shared Service - Generate Signatures for Different Folders', () => {
  const prodSig = generateUploadSignature('cheri/products');
  assert.ok(prodSig.signature, 'Signature should exist');
  assert.ok(prodSig.timestamp > 0, 'Timestamp should be positive');
  assert.equal(prodSig.folder, 'cheri/products');
  assert.ok(prodSig.cloudName, 'CloudName should exist');

  const cmsSig = generateUploadSignature('cheri/cms');
  assert.equal(cmsSig.folder, 'cheri/cms');

  const settingsSig = generateUploadSignature('cheri/settings');
  assert.equal(settingsSig.folder, 'cheri/settings');

  const fallbackSig = generateUploadSignature('unauthorized/folder');
  assert.equal(fallbackSig.folder, 'cheri/products', 'Should fallback to cheri/products for unrecognized folder');
});

test('Cloudinary Product Normalizer - Preserves External URLs without Re-uploading', async () => {
  const externalImages = [
    'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800',
    'https://cdn.example.com/item2.jpg'
  ];
  const mainImage = { url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800', name: 'Main' };

  const result = await normalizeProductImages(externalImages, mainImage);

  assert.deepEqual(result.images, externalImages, 'External images should NOT be changed');
  assert.equal(result.mainImage.url, mainImage.url, 'Main external image URL should NOT be changed');
});

test('Cloudinary Settings Normalizer - Preserves External URLs', async () => {
  const settings = {
    site: {
      name: 'Chéri Boutique',
      logo: 'https://cdn.example.com/logo.png',
      favicon: '/favicon.ico'
    }
  };

  const result = await normalizeSettingsImages(settings);
  assert.equal(result.site.logo, 'https://cdn.example.com/logo.png', 'External logo URL must be preserved');
  assert.equal(result.site.favicon, '/favicon.ico', 'Local favicon path must be preserved');
});

test('Cloudinary Service - Upload Base64 to cheri/products and cheri/settings', async () => {
  // 1x1 transparent PNG Base64
  const tinyPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  // Test Product Normalizer with Base64
  const productInput = {
    images: [tinyPngBase64, 'https://images.unsplash.com/photo-1?w=800'],
    mainImage: { url: tinyPngBase64, name: 'Sample' }
  };

  const prodResult = await normalizeProductImages(productInput.images, productInput.mainImage);
  assert.equal(prodResult.images.length, 2);
  assert.ok(isCloudinaryUrl(prodResult.images[0]), 'First image should be uploaded to Cloudinary');
  assert.ok(prodResult.images[0].includes('cheri/products'), 'URL should contain cheri/products');
  assert.equal(prodResult.images[1], 'https://images.unsplash.com/photo-1?w=800', 'Second external image preserved');
  assert.ok(isCloudinaryUrl(prodResult.mainImage.url), 'Main image should be Cloudinary URL');

  // Test Settings Normalizer with Base64
  const settingsInput = {
    site: {
      name: 'Chéri Test Store',
      logo: tinyPngBase64,
      favicon: tinyPngBase64
    }
  };

  const settingsResult = await normalizeSettingsImages(settingsInput);
  assert.ok(isCloudinaryUrl(settingsResult.site.logo), 'Logo should be uploaded to Cloudinary');
  assert.ok(settingsResult.site.logo.includes('cheri/settings'), 'Logo URL should contain cheri/settings');
  assert.ok(isCloudinaryUrl(settingsResult.site.favicon), 'Favicon should be uploaded to Cloudinary');
  assert.ok(settingsResult.site.favicon.includes('cheri/settings'), 'Favicon URL should contain cheri/settings');
});
