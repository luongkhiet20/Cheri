const allowedEndpoints = new Set([
  'forgot-password',
  'verify-reset-otp',
  'reset-password',
]);

module.exports = async (req, res) => {
  const endpoint = req.query?.endpoint;

  if (!allowedEndpoints.has(endpoint)) {
    return res.status(404).json({ message: 'Password reset endpoint not found' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const configuredBackendUrl = process.env.NEST_API_URL?.trim();
  if (!configuredBackendUrl) {
    return res.status(503).json({
      message: 'Password reset service is not configured',
    });
  }

  let backendUrl;
  try {
    backendUrl = new URL(configuredBackendUrl);
  } catch {
    return res.status(503).json({
      message: 'Password reset service has an invalid backend URL',
    });
  }

  if (!['http:', 'https:'].includes(backendUrl.protocol)) {
    return res.status(503).json({
      message: 'Password reset service has an invalid backend URL',
    });
  }

  try {
    const upstream = await fetch(
      new URL(`/api/auth/${endpoint}`, backendUrl),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req.body ?? {}),
      },
    );
    const responseBody = await upstream.text();
    const contentType = upstream.headers.get('content-type');

    if (contentType) {
      res.setHeader('content-type', contentType);
    }

    return res.status(upstream.status).send(responseBody);
  } catch (error) {
    console.error(
      'Password reset backend request failed:',
      error instanceof Error ? error.message : 'Unknown network error',
    );
    return res.status(502).json({
      message: 'Password reset service is temporarily unavailable',
    });
  }
};
