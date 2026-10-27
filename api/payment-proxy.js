const XXPAY_BASE = 'https://api.xxpayconnect.com/api/v1/public';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const clientId = process.env.XXPAY_CLIENT_ID;
  const clientSecret = process.env.XXPAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Missing XXPAY_CLIENT_ID or XXPAY_CLIENT_SECRET env vars' });
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

  const externalRef = `revo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const body = {
    amount: amountMxn,
    currency: 'MXN',
    method: 'spei',
    description: paymentDescription || product || 'RevolutBank Credit',
    external_reference: externalRef,
    payer: {
      name: payer.name || 'Customer',
      email: payer.email || undefined,
      document: (payer.document || '').replace(/\D/g, '') || undefined,
      phone: (payer.phone || '').replace(/\D/g, '') || undefined,
      country: 'MX',
    },
  };

  const callbackUrl = process.env.XXPAY_CALLBACK_URL;
  if (callbackUrl) body.callback_url = callbackUrl;

  try {
    const xxpayRes = await fetch(`${XXPAY_BASE}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': clientId,
        'X-Client-Secret': clientSecret,
      },
      body: JSON.stringify(body),
    });

    const data = await xxpayRes.json();

    if (!xxpayRes.ok) {
      return res.status(502).json({ error: data.message || data.error || 'XXPay error' });
    }

    const action = data.next_action || {};

    return res.status(200).json({
      id: data.id,
      transaction_id: data.id,
      clabe: action.clabe,
      reference: action.reference,
      bank_name: action.bank,
      beneficiary: action.beneficiary,
      amount_mxn: amountMxn,
      amount_eur: parseFloat(amount),
    });
  } catch (err) {
    console.error('[payment-proxy] error:', err);
    return res.status(500).json({ error: 'Payment creation failed' });
  }
};
