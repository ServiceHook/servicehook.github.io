export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const idToken = body.token;

    if (!idToken) return new Response("Missing Token", { status: 401 });

    // 1. VERIFY USER with Google
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_WEB_API_KEY}`;
    const googleRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: idToken })
    });

    const googleData = await googleRes.json();
    if (!googleData.users || googleData.users.length === 0) {
      return new Response("Invalid Token", { status: 403 });
    }

    const uid = googleData.users[0].localId;

    // 2. CHECK IF KEY ALREADY EXISTS
    const userLookupUrl = `${env.FIREBASE_DB_URL}/users/${uid}/api_key.json?auth=${env.FIREBASE_DB_SECRET}`;
    const existingKeyRes = await fetch(userLookupUrl);
    let apiKey = await existingKeyRes.json();
    
    let keyData = { usage: 0, limit: 50 }; // Default values

    if (apiKey) {
      // Key exists, fetch its current usage stats
      const keyStatsUrl = `${env.FIREBASE_DB_URL}/api_keys/${apiKey}.json?auth=${env.FIREBASE_DB_SECRET}`;
      const statsRes = await fetch(keyStatsUrl);
      const existingData = await statsRes.json();
      
      if (existingData) {
        keyData = existingData;
      }
    } else {
      // Generate New Key if none exists
      apiKey = crypto.randomUUID().replace(/-/g, '');
      
      // Save User -> Key mapping
      await fetch(userLookupUrl, { method: 'PUT', body: JSON.stringify(apiKey) });

      // Initialize Key Data
      keyData = {
        uid: uid,
        usage: 0,
        limit: 50,
        month: new Date().getMonth()
      };
      
      await fetch(`${env.FIREBASE_DB_URL}/api_keys/${apiKey}.json?auth=${env.FIREBASE_DB_SECRET}`, {
        method: 'PUT',
        body: JSON.stringify(keyData)
      });
    }

    // 3. RETURN KEY + REAL USAGE DATA
    return new Response(JSON.stringify({ 
      status: "success", 
      api_key: apiKey,
      usage: keyData.usage || 0,
      limit: keyData.limit || 50
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}