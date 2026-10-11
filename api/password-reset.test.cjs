const assert = require('node:assert/strict');
const test = require('node:test');

const passwordResetProxy = require('./password-reset');

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

test('rejects requests when the NestJS backend URL is not configured', async () => {
  const previousBackendUrl = process.env.NEST_API_URL;
  delete process.env.NEST_API_URL;
  const response = createResponse();

  try {
    await passwordResetProxy(
      { method: 'POST', query: { endpoint: 'forgot-password' }, body: {} },
      response,
    );

    assert.equal(response.statusCode, 503);
    assert.equal(
      response.body.message,
      'Password reset service is not configured',
    );
  } finally {
    if (previousBackendUrl === undefined) {
      delete process.env.NEST_API_URL;
    } else {
      process.env.NEST_API_URL = previousBackendUrl;
    }
  }
});

test('only forwards the three password reset endpoints', async () => {
  const response = createResponse();

  await passwordResetProxy(
    { method: 'POST', query: { endpoint: 'signin' }, body: {} },
    response,
  );

  assert.equal(response.statusCode, 404);
});

test('forwards the OTP request and returns the NestJS response', async () => {
  const previousBackendUrl = process.env.NEST_API_URL;
  const previousFetch = global.fetch;
  process.env.NEST_API_URL = 'https://cheri-api.example.com/';
  let requestedUrl;
  let requestOptions;
  global.fetch = async (url, options) => {
    requestedUrl = url.toString();
    requestOptions = options;
    return {
      status: 200,
      headers: { get: () => 'application/json; charset=utf-8' },
      text: async () => '{"message":"OTP requested"}',
    };
  };
  const response = createResponse();

  try {
    await passwordResetProxy(
      {
        method: 'POST',
        query: { endpoint: 'forgot-password' },
        body: { email: 'customer@example.com' },
      },
      response,
    );

    assert.equal(
      requestedUrl,
      'https://cheri-api.example.com/api/auth/forgot-password',
    );
    assert.equal(requestOptions.method, 'POST');
    assert.deepEqual(JSON.parse(requestOptions.body), {
      email: 'customer@example.com',
    });
    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers['content-type'],
      'application/json; charset=utf-8',
    );
    assert.equal(response.body, '{"message":"OTP requested"}');
  } finally {
    global.fetch = previousFetch;
    if (previousBackendUrl === undefined) {
      delete process.env.NEST_API_URL;
    } else {
      process.env.NEST_API_URL = previousBackendUrl;
    }
  }
});
