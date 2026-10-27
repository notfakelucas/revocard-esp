const XXPAY_BASE = 'https://api.xxpayconnect.com/api/v1/public';

const STATUS_MAP = {
  paid:    'COMPLETED',
  failed:  'DECLINED',
  pending: 'PENDING',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const clientId = process.env.XXPAY_CLIENT_ID;
  const clientSecret = process.env.XXPAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Missing XXPAY_CLIENT_ID or XXPAY_CLIENT_SECRET env vars' });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    const xxpayRes = await fetch(`${XXPAY_BASE}/payments/${encodeURIComponent(id)}`, {
      headers: {
        'X-Client-Id': clientId,
        'X-Client-Secret': clientSecret,
      },
    });

    const data = await xxpayRes.json();

    if (!xxpayRes.ok) {
      return res.status(502).json({ error: data.message || 'XXPay error' });
    }

    const status = STATUS_MAP[data.status] || 'PENDING';
    return res.status(200).json({ status, raw: data.status });
  } catch (err) {
    console.error('[status] error:', err);
    return res.status(500).json({ error: 'Status check failed' });
  }
};
