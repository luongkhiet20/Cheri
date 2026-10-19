/**
 * Cloudinary Service for Chéri E-commerce
 * Shared between NestJS Local and Express/Serverless on Vercel
 *
 * Folder Classification:
 * - cheri/avatars/      : User and Admin profile pictures
 * - cheri/return-proofs/: Order return/refund proof images
 * - cheri/products/     : Product main and gallery images
 * - cheri/cms/          : CMS Home and About banner, hero, editorial images
 * - cheri/settings/     : Store branding (logo, favicon)
 */

const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const ALLOWED_FOLDERS = [
  'cheri/avatars',
  'cheri/return-proofs',
  'cheri/products',
  'cheri/cms',
  'cheri/settings'
];

/**
 * Get Cloudinary configuration and initialize SDK
 */
function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_NAME || process.env.CLOUDINARY_CLOUD_NAME || '';
  const apiKey = process.env.CLOUDINARY_KEY || process.env.CLOUDINARY_API_KEY || '';
  const apiSecret = process.env.CLOUDINARY_SECRET || process.env.CLOUDINARY_API_SECRET || '';

  const isConfigured = Boolean(
    cloudName &&
    apiKey &&
    apiSecret &&
    !apiKey.includes('dummy') &&
    !apiKey.includes('placeholder')
  );

  if (isConfigured) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });
  }

  return { cloudName, apiKey, apiSecret, isConfigured };
}

/**
 * Sanitize and validate target folder against approved functional hierarchy
 */
function sanitizeFolder(targetFolder = 'cheri/products') {
  const raw = String(targetFolder || 'cheri/products').trim().replace(/\\/g, '/');
  // Match prefix against allowed folders
  const matched = ALLOWED_FOLDERS.find(allowed => raw === allowed || raw.startsWith(allowed + '/'));
  if (matched) {
    // Keep allowed prefix plus any sanitized subfolder
    return raw.replace(/[^a-zA-Z0-9_\-\/]/g, '').replace(/\/+/g, '/').replace(/\/$/, '');
  }
  return 'cheri/products';
}

/**
 * Generate a signed upload token for client-side direct upload
 * Prevents exposing api_secret to client while bypassing Vercel 4.5MB request limit
 */
function generateUploadSignature(targetFolder = 'cheri/products') {
  const { cloudName, apiKey, apiSecret, isConfigured } = getCloudinaryConfig();
  if (!isConfigured) {
    throw new Error('Dịch vụ lưu trữ Cloudinary chưa được cấu hình biến môi trường trên máy chủ');
  }

  const folder = sanitizeFolder(targetFolder);
  const timestamp = Math.round(new Date().getTime() / 1000);

  const paramsToSign = {
    folder,
    timestamp
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder
  };
}

/**
 * Legacy wrapper for backward compatibility with return-proofs upload
 */
function generateReturnUploadSignature(subfolder = '') {
  const cleanSub = String(subfolder || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const folder = cleanSub ? `cheri/return-proofs/${cleanSub}` : 'cheri/return-proofs';
  return generateUploadSignature(folder);
}

/**
 * General purpose upload function for Buffer, Stream, or Base64/Data URI
 */
async function uploadToCloudinary(fileOrBase64, options = {}) {
  const { isConfigured } = getCloudinaryConfig();
  if (!isConfigured) {
    throw new Error('Cloudinary chưa được cấu hình đầy đủ thông tin xác thực');
  }

  const folder = sanitizeFolder(options.folder || 'cheri/products');
  const uploadOptions = {
    folder,
    resource_type: options.resource_type || 'image',
    tags: ['cheri-app', ...(options.tags || [])]
  };

  // If input is a Buffer (e.g. from multer memoryStorage)
  if (Buffer.isBuffer(fileOrBase64)) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (result) {
            resolve({
              secure_url: result.secure_url,
              url: result.secure_url,
              public_id: result.public_id,
              bytes: result.bytes,
              format: result.format
            });
          } else {
            reject(error);
          }
        }
      );
      streamifier.createReadStream(fileOrBase64).pipe(uploadStream);
    });
  }

  // If input is a Base64 string, Data URI or HTTP URL
  const result = await cloudinary.uploader.upload(fileOrBase64, uploadOptions);
  return {
    secure_url: result.secure_url,
    url: result.secure_url,
    public_id: result.public_id,
    bytes: result.bytes,
    format: result.format
  };
}

/**
 * Upload a single image to Cloudinary return-proofs folder
 */
async function uploadReturnProof(fileOrBase64, options = {}) {
  return uploadToCloudinary(fileOrBase64, {
    folder: options.folder || 'cheri/return-proofs',
    tags: ['cheri-return-proof', ...(options.tags || [])]
  });
}

/**
 * Delete a Cloudinary asset by public_id (for cleanup on failed request)
 */
async function deleteCloudinaryAsset(publicId) {
  try {
    const { isConfigured } = getCloudinaryConfig();
    if (!isConfigured || !publicId) return;
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('[Cloudinary Cleanup Warning]:', err?.message || err);
  }
}

/**
 * Check if a URL is a legitimate Cloudinary URL
 */
function isCloudinaryUrl(url) {
  if (typeof url !== 'string') return false;
  return url.startsWith('https://res.cloudinary.com/') || url.startsWith('http://res.cloudinary.com/');
}

/**
 * Normalize and ensure all proof images are saved as Cloudinary HTTPS URLs
 */
async function normalizeReturnProofImages(images) {
  if (!Array.isArray(images) || images.length === 0) {
    return [];
  }

  const normalizedUrls = [];
  const newlyUploadedPublicIds = [];

  try {
    for (const item of images) {
      if (!item) continue;

      const rawUrl = typeof item === 'object' && item.url ? item.url : String(item);

      // Case 1: Already a Cloudinary URL -> keep verified HTTPS URL
      if (isCloudinaryUrl(rawUrl)) {
        normalizedUrls.push(rawUrl.trim());
        continue;
      }

      // Case 2: Base64 Data URI -> Upload to Cloudinary
      if (rawUrl.startsWith('data:image')) {
        const uploadRes = await uploadReturnProof(rawUrl, { folder: 'cheri/return-proofs' });
        if (!uploadRes || !uploadRes.secure_url) {
          throw new Error('Upload ảnh lên Cloudinary không trả về đường dẫn an toàn');
        }
        newlyUploadedPublicIds.push(uploadRes.public_id);
        normalizedUrls.push(uploadRes.secure_url);
        continue;
      }

      // Case 3: External HTTP/HTTPS URL or legacy path -> keep intact
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('/uploads/')) {
        normalizedUrls.push(rawUrl.trim());
        continue;
      }

      throw new Error('Định dạng hình ảnh minh chứng không được hỗ trợ: ' + rawUrl.substring(0, 50));
    }

    return normalizedUrls;
  } catch (err) {
    for (const pid of newlyUploadedPublicIds) {
      await deleteCloudinaryAsset(pid);
    }
    throw err;
  }
}

/**
 * Normalize product gallery and main images:
 * - If user uploads a file/Base64, upload to `cheri/products/`
 * - If user references an external image URL, preserve as-is (do NOT re-upload)
 * - Preserve existing legacy URLs and Cloudinary URLs
 */
async function normalizeProductImages(rawImages = [], rawMainImage = null) {
  let images = Array.isArray(rawImages) ? [...rawImages] : [];
  let mainImage = rawMainImage && typeof rawMainImage === 'object'
    ? { ...rawMainImage }
    : { url: typeof rawMainImage === 'string' ? rawMainImage : '', name: '' };

  const normalizedImages = [];

  for (const item of images) {
    if (!item) continue;
    const str = typeof item === 'object' && item.url ? item.url : String(item);

    // If Base64 data URI -> upload to cheri/products
    if (str.startsWith('data:image')) {
      try {
        const res = await uploadToCloudinary(str, { folder: 'cheri/products', tags: ['product-gallery'] });
        normalizedImages.push(res.secure_url);
      } catch (err) {
        console.warn('[Cloudinary Product Image Warning]:', err?.message || err);
        // Fallback: keep original if upload fails
        normalizedImages.push(str);
      }
    } else {
      // External URL or existing Cloudinary URL -> preserve as-is
      normalizedImages.push(str.trim());
    }
  }

  // Handle main image
  if (mainImage.url && mainImage.url.startsWith('data:image')) {
    try {
      const res = await uploadToCloudinary(mainImage.url, { folder: 'cheri/products', tags: ['product-main'] });
      mainImage.url = res.secure_url;
    } catch (err) {
      console.warn('[Cloudinary Main Image Warning]:', err?.message || err);
    }
  }

  // If no main image but gallery has images, set first image as main
  if (!mainImage.url && normalizedImages.length > 0) {
    mainImage.url = normalizedImages[0];
  }

  return {
    images: normalizedImages,
    mainImage
  };
}

/**
 * Normalize settings images (logo and favicon):
 * - If Base64, upload to `cheri/settings/`
 * - If external URL or existing path, preserve as-is
 */
async function normalizeSettingsImages(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  const site = settings.site ? { ...settings.site } : null;
  if (!site) return settings;

  if (site.logo && site.logo.startsWith('data:image')) {
    try {
      const res = await uploadToCloudinary(site.logo, { folder: 'cheri/settings', tags: ['settings-logo'] });
      site.logo = res.secure_url;
    } catch (err) {
      console.warn('[Cloudinary Settings Logo Warning]:', err?.message || err);
    }
  }

  if (site.favicon && site.favicon.startsWith('data:image')) {
    try {
      const res = await uploadToCloudinary(site.favicon, { folder: 'cheri/settings', tags: ['settings-favicon'] });
      site.favicon = res.secure_url;
    } catch (err) {
      console.warn('[Cloudinary Settings Favicon Warning]:', err?.message || err);
    }
  }

  return {
    ...settings,
    site
  };
}

module.exports = {
  ALLOWED_FOLDERS,
  getCloudinaryConfig,
  sanitizeFolder,
  generateUploadSignature,
  generateReturnUploadSignature,
  uploadToCloudinary,
  uploadReturnProof,
  deleteCloudinaryAsset,
  isCloudinaryUrl,
  normalizeReturnProofImages,
  normalizeProductImages,
  normalizeSettingsImages
};
