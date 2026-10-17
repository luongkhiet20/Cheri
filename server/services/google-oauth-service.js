/**
 * Google OAuth Service for Chéri E-commerce
 * Stateless & Serverless-Ready implementation for Vercel & Express
 */

const https = require('https');

/**
 * Universal HTTP Request helper (supports native fetch with https fallback)
 */
function makeHttpRequest(urlStr, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    if (typeof globalThis.fetch === 'function') {
      const fetchOptions = {
        method: options.method || 'GET',
        headers: options.headers || {}
      };
      if (postData) {
        fetchOptions.body = postData;
      }
      return globalThis.fetch(urlStr, fetchOptions)
        .then(async (res) => {
          const text = await res.text();
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (_) {}
          if (!res.ok) {
            const errMsg = (json && (json.error_description || json.error || json.message)) || `HTTP ${res.status}: ${text}`;
            const err = new Error(errMsg);
            err.status = res.status;
            err.data = json || text;
            throw err;
          }
          resolve(json || text);
        })
        .catch(reject);
    }

    // Native https fallback
    const parsedUrl = new URL(urlStr);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const errMsg = (json && (json.error_description || json.error || json.message)) || `HTTP ${res.statusCode}: ${data}`;
          const err = new Error(errMsg);
          err.status = res.statusCode;
          err.data = json || data;
          return reject(err);
        }
        resolve(json || data);
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Google OAuth request timed out'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * Determine the exact Google callback URL
 */
function getGoogleCallbackUrl(req) {
  if (process.env.GOOGLE_CALLBACK_URL && process.env.GOOGLE_CALLBACK_URL.trim()) {
    return process.env.GOOGLE_CALLBACK_URL.trim().replace(/\/+$/, '');
  }
  const host = req.get('x-forwarded-host') || req.get('host') || 'cheri-three.vercel.app';
  let proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
  if (host.includes('vercel.app')) {
    proto = 'https';
  }
  return `${proto}://${host}/api/auth/google/callback`;
}

/**
 * Determine the Frontend Origin for redirection
 */
function getFrontendOrigin(req) {
  if (process.env.ORIGIN && process.env.ORIGIN.trim()) {
    return process.env.ORIGIN.trim().replace(/\/+$/, '');
  }
  const host = req.get('x-forwarded-host') || req.get('host') || 'cheri-three.vercel.app';
  let proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
  if (host.includes('vercel.app')) {
    proto = 'https';
  }
  return `${proto}://${host}`;
}

/**
 * Generate Google OAuth consent screen URL
 */
function getGoogleAuthUrl(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }
  const callbackUrl = getGoogleCallbackUrl(req);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange Authorization Code for Google Tokens
 */
async function exchangeCodeForTokens(code, callbackUrl) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials (CLIENT_ID / CLIENT_SECRET) are missing');
  }

  const bodyParams = new URLSearchParams({
    code: code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: callbackUrl,
    grant_type: 'authorization_code'
  });

  return makeHttpRequest('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }, bodyParams.toString());
}

/**
 * Fetch Google User Profile using Access Token
 */
async function fetchGoogleUserProfile(accessToken) {
  return makeHttpRequest('https://www.googleapis.com/oauth2/v3/userinfo', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
}

/**
 * Find or create user in MongoDB collection 'users'
 */
async function syncGoogleUserWithDb(db, profile) {
  if (!profile || !profile.email) {
    throw new Error('Không thể lấy thông tin email từ tài khoản Google');
  }
  const cleanEmail = String(profile.email).trim().toLowerCase();
  let user = await db.collection('users').findOne({ email: cleanEmail });
  let isNewUser = false;

  const profileName = (profile.name || profile.displayName || cleanEmail.split('@')[0] || 'User').trim();
  const avatarUrl = profile.picture || (profile.photos && profile.photos[0] && profile.photos[0].value) || '';

  if (user) {
    isNewUser = false;
    // 1. Kiểm tra tài khoản có bị khóa không
    if (user.status === false) {
      const lockErr = new Error('Tài khoản của bạn đã bị khóa hoặc ngừng hoạt động');
      lockErr.code = 'ACCOUNT_LOCKED';
      throw lockErr;
    }

    // 2. Cập nhật thông tin bổ sung nếu tài khoản cũ chưa có
    const updateFields = { updatedAt: new Date() };
    if (!user.googleId && profile.sub) {
      updateFields.googleId = profile.sub;
    }
    if (!user.name && profileName) {
      updateFields.name = profileName;
    }
    if (!user.fullName && profileName) {
      updateFields.fullName = profileName;
    }
    if (!user.avatar && avatarUrl) {
      updateFields.avatar = avatarUrl;
    }
    if ((!user.images || user.images.length === 0) && avatarUrl) {
      updateFields.images = [avatarUrl];
    }

    if (Object.keys(updateFields).length > 1) {
      await db.collection('users').updateOne({ _id: user._id }, { $set: updateFields });
      user = { ...user, ...updateFields };
    }
  } else {
    // 3. Tạo tài khoản Google mới
    isNewUser = true;
    const now = new Date();
    const newUser = {
      email: cleanEmail,
      googleId: profile.sub || null,
      name: profileName,
      fullName: profileName,
      avatar: avatarUrl,
      images: avatarUrl ? [avatarUrl] : [],
      roles: ['user'],
      status: true,
      cart: [],
      createdAt: now,
      updatedAt: now
    };

    try {
      const result = await db.collection('users').insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    } catch (err) {
      if (err && err.code === 11000) {
        user = await db.collection('users').findOne({ email: cleanEmail });
        isNewUser = false;
      } else {
        throw err;
      }
    }
  }

  return { user, isNewUser };
}

/**
 * Generate Access Token & Short-Lived Single-Use JWT Exchange Code (5 mins TTL)
 */
function createTokensAndExchangeCode(jwt, user, isNewUser = false) {
  const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_eshop_123456789';
  const jwtExpiration = process.env.JWT_EXPIRATION || '7d';

  const payload = {
    email: user.email,
    id: user._id.toString(),
    roles: Array.isArray(user.roles) ? user.roles : ['user']
  };
  const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiration });

  const rawAvatar = user.avatar || user.avatarUrl || (Array.isArray(user.images) && user.images[0]) || '';
  const userObj = {
    id: user._id.toString(),
    _id: user._id.toString(),
    email: user.email,
    roles: Array.isArray(user.roles) ? user.roles : ['user'],
    name: user.name || user.fullName || user.email.split('@')[0],
    fullName: user.fullName || user.name || user.email.split('@')[0],
    avatar: rawAvatar,
    avatarUrl: rawAvatar,
    images: Array.isArray(user.images) && user.images.length > 0 ? user.images : (rawAvatar ? [rawAvatar] : [])
  };

  // JWT Exchange Code: Signed with system JWT_SECRET, 5-minute expiry, stateless & serverless-ready
  const exchangePayload = {
    type: 'oauth_exchange',
    accessToken,
    user: userObj,
    isNewUser: Boolean(isNewUser)
  };
  const exchangeCode = jwt.sign(exchangePayload, jwtSecret, { expiresIn: '5m' });

  return { accessToken, exchangeCode, user: userObj, isNewUser };
}

/**
 * Verify Exchange Code and return user credentials
 */
function verifyExchangeCode(jwt, code) {
  if (!code || typeof code !== 'string') {
    throw new Error('Mã trao đổi xác thực không hợp lệ');
  }
  const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_eshop_123456789';
  const decoded = jwt.verify(code, jwtSecret);
  if (!decoded || decoded.type !== 'oauth_exchange' || !decoded.accessToken) {
    throw new Error('Mã trao đổi xác thực không hợp lệ');
  }
  return {
    accessToken: decoded.accessToken,
    user: decoded.user,
    isNewUser: decoded.isNewUser || false
  };
}

module.exports = {
  getGoogleCallbackUrl,
  getFrontendOrigin,
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleUserProfile,
  syncGoogleUserWithDb,
  createTokensAndExchangeCode,
  verifyExchangeCode
};
