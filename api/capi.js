const crypto = require('crypto');

const PIXEL_ID = '2332401467564454';
const HASHED_HEX_RE = /^[a-f0-9]{64}$/i;

function normalizeAndHash(value) {
  if (!value) return undefined;
  const trimmed = String(value).trim().toLowerCase();
  if (HASHED_HEX_RE.test(trimmed)) return trimmed;
  return crypto.createHash('sha256').update(trimmed).digest('hex');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!accessToken) {
    res.status(500).json({ error: 'Missing META_CAPI_ACCESS_TOKEN env var' });
    return;
  }

  const { event_name, event_id, event_source_url, user_data = {}, custom_data } = req.body || {};
  if (!event_name) {
    res.status(400).json({ error: 'event_name is required' });
    return;
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  const clientIp = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || '').split(',')[0].trim() || req.socket?.remoteAddress;

  const payload = {
    data: [{
      event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id,
      event_source_url,
      action_source: 'website',
      user_data: {
        client_ip_address: clientIp,
        client_user_agent: req.headers['user-agent'],
        em: normalizeAndHash(user_data.email),
        ph: normalizeAndHash(user_data.phone),
        fbp: user_data.fbp,
        fbc: user_data.fbc,
      },
      custom_data,
    }],
  };

  try {
    const metaRes = await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await metaRes.json();
    res.status(metaRes.ok ? 200 : 502).json(data);
  } catch (err) {
    res.status(500).json({ error: 'CAPI request failed' });
  }
};
