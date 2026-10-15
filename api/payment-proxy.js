const XPAG_BASE = 'https://api.xpag.global';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clientId = process.env.XPAG_CLIENT_ID;
  const clientSecret = process.env.XPAG_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Missing XPAG_CLIENT_ID or XPAG_CLIENT_SECRET env vars' });
  }

  const { amount, currency = 'MXN', payer = {}, paymentDescription, product, _utms } = req.body || {};

  if (!amount || isNaN(parseFloat(amount))) {
    return res.status(400).json({ error: 'amount is required' });
  }

  // If already MXN, use as-is; otherwise convert EUR → MXN
  let amountMxn;
  if (currency === 'MXN') {
    amountMxn = parseFloat(amount);
  } else {
    try {
      const fxRes = await fetch('https://api.frankfurter.dev/v1/latest?from=EUR&to=MXN');
      const fxData = await fxRes.json();
      const rate = fxData?.rates?.MXN;
      if (!rate) throw new Error('no rate');
      amountMxn = Math.round(parseFloat(amount) * rate * 100) / 100;
    } catch (_) {
      amountMxn = Math.round(parseFloat(amount) * 22 * 100) / 100;
    }
  }

  const externalId = `revo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const body = {
    currency: 'MXN',
    amount: amountMxn,
    name: payer.name || 'Customer',
    document: (payer.document || '').replace(/\D/g, '') || '000000000',
    description: paymentDescription || product || 'RevolutBank Credit',
    external_id: externalId,
  };

  const webhookUrl = process.env.XPAG_WEBHOOK_URL;
  if (webhookUrl) body.webhook_url = webhookUrl;

  try {
    const xpagRes = await fetch(`${XPAG_BASE}/cashin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': clientId,
        'X-Client-Secret': clientSecret,
      },
      body: JSON.stringify(body),
    });

    const data = await xpagRes.json();

    if (!xpagRes.ok || !data.ok) {
      return res.status(502).json({ error: data.message || data.error_code || 'XPAG error' });
    }

    return res.status(200).json({
      id: data.transaction_id || data.request_number,
      transaction_id: data.transaction_id || data.request_number,
      clabe: data.clabe,
      reference: data.reference,
      bank_name: data.bank_name,
      beneficiary: data.beneficiary,
      amount_mxn: amountMxn,
      amount_eur: parseFloat(amount),
    });
  } catch (err) {
    console.error('[payment-proxy] error:', err);
    return res.status(500).json({ error: 'Payment creation failed' });
  }
};
