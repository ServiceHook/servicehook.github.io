// Verification helper
async function verifyFirebaseIdToken(idToken, env) {
  if (!idToken) return null;
  const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_WEB_API_KEY}`;
  const verifyRes = await fetch(verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });
  const verifyData = await verifyRes.json();
  if (!verifyRes.ok || !verifyData.users || verifyData.users.length === 0) return null;
  return verifyData.users[0];
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json'
    }
  });
}

function sanitizeText(value, maxLen = 240) {
  if (!value) return '';
  return String(value).replace(/[<>]/g, '').trim().slice(0, maxLen);
}

// Maps incoming data to database schema
function mapDonationRecord(input) {
  const amount = Number(input.amount || 0);
  const paymentId = sanitizeText(input.paymentId, 80);

  if (!paymentId || !/^pay_/i.test(paymentId)) {
    throw new Error('Invalid payment id');
  }

  if (!amount || amount < 1 || amount > 1000000) {
    throw new Error('Invalid amount');
  }

  return {
    amount,
    amountInPaise: Math.round(amount * 100),
    currency: sanitizeText(input.currency || 'INR', 10) || 'INR',
    donorName: sanitizeText(input.donorName || 'Anonymous', 80) || 'Anonymous',
    donorEmail: sanitizeText(input.donorEmail || '', 120),
    donorPhone: sanitizeText(input.donorPhone || '', 25),
    anonymous: Boolean(input.anonymous),
    purpose: sanitizeText(input.purpose || 'General support', 120),
    donorNote: sanitizeText(input.donorNote || 'No note', 240) || 'No note',
    paymentId,
    orderId: sanitizeText(input.orderId || '', 80),
    signature: sanitizeText(input.signature || '', 180),
    status: 'captured', // Marked as captured for record keeping
    source: sanitizeText(input.source || 'donate_page', 40),
    createdAt: Number(input.createdAt) || Date.now()
  };
}

// Saves using Server Secret (Bypassing User Rules)
async function saveDonation(body, env) {
  const donation = mapDonationRecord(body);
  const saveUrl = `${env.FIREBASE_DB_URL}/donations/${donation.paymentId}.json?auth=${env.FIREBASE_DB_SECRET}`;

  await fetch(saveUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(donation)
  });

  return donation;
}

// Fetches list for Admin
async function getDonations(env) {
  const listUrl = `${env.FIREBASE_DB_URL}/donations.json?auth=${env.FIREBASE_DB_SECRET}`;
  const res = await fetch(listUrl);
  const raw = await res.json();
  const donations = Object.values(raw || {}).sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

  const totalAmount = donations.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  return {
    donations,
    stats: {
      count: donations.length,
      totalAmount
    }
  };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders() });
  }

  try {
    // PUBLIC: Save Donation (Called by donate.html after Razorpay success)
    if (request.method === 'POST') {
      const body = await request.json();
      const saved = await saveDonation(body, env);
      return jsonResponse({ status: 'success', donation: saved }, 200);
    }

    // PROTECTED: Get Donations (Called by Admin Panel)
    if (request.method === 'GET') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const user = await verifyFirebaseIdToken(token, env);

      if (!user || user.email !== env.ADMIN_EMAIL) {
        return jsonResponse({ status: 'error', message: 'Unauthorized' }, 403);
      }

      const data = await getDonations(env);
      return jsonResponse({ status: 'success', ...data }, 200);
    }

    return jsonResponse({ status: 'error', message: 'Method not allowed' }, 405);
  } catch (error) {
    return jsonResponse({ status: 'error', message: error.message || 'Unknown error' }, 400);
  }
}