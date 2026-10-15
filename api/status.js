const XPAG_BASE = 'https://api.xpag.global';

const STATUS_MAP = {
  confirmed: 'COMPLETED',
  expired:   'DECLINED',
  failed:    'DECLINED',
  pending:   'PENDING',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const clientId = process.env.XPAG_CLIENT_ID;
  const clientSecret = process.env.XPAG_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Missing XPAG_CLIENT_ID or XPAG_CLIENT_SECRET env vars' });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    const xpagRes = await fetch(
      `${XPAG_BASE}/consult-transaction?transaction_id=${encodeURIComponent(id)}`,
      {
        headers: {
          'X-Client-Id': clientId,
          'X-Client-Secret': clientSecret,
        },
      }
    );

    const data = await xpagRes.json();

    if (!xpagRes.ok || !data.ok) {
      return res.status(502).json({ error: data.message || 'XPAG error' });
    }

    const status = STATUS_MAP[data.status] || 'PENDING';
    return res.status(200).json({ status, raw: data.status });
  } catch (err) {
    console.error('[status] error:', err);
    return res.status(500).json({ error: 'Status check failed' });
  }
};
