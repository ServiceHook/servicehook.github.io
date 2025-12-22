export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const idToken = body.token;
    const shouldRegenerate = body.regenerate === true;

    if (!idToken) return new Response(JSON.stringify({ error: "Missing Token" }), { status: 401 });

    // 1. VERIFY USER
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_WEB_API_KEY}`;
    const googleRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: idToken })
    });

    const googleData = await googleRes.json();
    if (!googleData.users || googleData.users.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid Token" }), { status: 403 });
    }

    const uid = googleData.users[0].localId;

    // 2. CHECK EXISTING KEY
    const userLookupUrl = `${env.FIREBASE_DB_URL}/users/${uid}/api_key.json?auth=${env.FIREBASE_DB_SECRET}`;
    const existingKeyRes = await fetch(userLookupUrl);
    let currentKey = await existingKeyRes.json();
    
    // Default Data (Free Tier)
    let keyData = { usage: 0, limit: 50, uid: uid }; 

    // 3. HANDLE PRESERVATION OR CREATION
    if (currentKey) {
      // Get data of OLD key to preserve limit
      const keyStatsUrl = `${env.FIREBASE_DB_URL}/api_keys/${currentKey}.json?auth=${env.FIREBASE_DB_SECRET}`;
      const statsRes = await fetch(keyStatsUrl);
      const existingData = await statsRes.json();
      
      if (existingData) {
        keyData = existingData; // Copy usage/limit
      }

      if (shouldRegenerate) {
        // Delete Old Key
        await fetch(keyStatsUrl, { method: 'DELETE' });
        
        // Generate New Key ID
        currentKey = crypto.randomUUID().replace(/-/g, '');
        
        // Update User Mapping
        await fetch(userLookupUrl, { method: 'PUT', body: JSON.stringify(currentKey) });
        
        // Save New Key with PRESERVED Data
        await fetch(`${env.FIREBASE_DB_URL}/api_keys/${currentKey}.json?auth=${env.FIREBASE_DB_SECRET}`, {
          method: 'PUT',
          body: JSON.stringify(keyData)
        });
      }
    } else {
      // First Time User
      currentKey = crypto.randomUUID().replace(/-/g, '');
      await fetch(userLookupUrl, { method: 'PUT', body: JSON.stringify(currentKey) });
      await fetch(`${env.FIREBASE_DB_URL}/api_keys/${currentKey}.json?auth=${env.FIREBASE_DB_SECRET}`, {
        method: 'PUT',
        body: JSON.stringify(keyData)
      });
    }

    return new Response(JSON.stringify({ 
      status: "success", 
      api_key: currentKey,
      usage: keyData.usage || 0,
      limit: keyData.limit || 50
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}