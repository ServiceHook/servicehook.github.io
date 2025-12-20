export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const idToken = body.token; // User sends their Firebase Auth Token

    if (!idToken) return new Response("Missing Token", { status: 401 });

    // 1. VERIFY USER with Google (Securely)
    // We ask Google: "Is this user token valid?"
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

    const uid = googleData.users[0].localId; // The real User ID

    // 2. CHECK IF KEY ALREADY EXISTS
    // We store a lookup: users/{uid}/api_key
    const userLookupUrl = `${env.FIREBASE_DB_URL}/users/${uid}/api_key.json?auth=${env.FIREBASE_DB_SECRET}`;
    const existingKeyRes = await fetch(userLookupUrl);
    const existingKey = await existingKeyRes.json();

    let apiKey = existingKey;
    
    // If no key exists, generate a new one
    if (!apiKey) {
      apiKey = crypto.randomUUID().replace(/-/g, '');
      
      // Save the link: User -> Key
      await fetch(userLookupUrl, { method: 'PUT', body: JSON.stringify(apiKey) });

      // Save the Key Rules: Key -> Usage Data
      const keyData = {
        uid: uid,
        usage: 0,
        limit: 50,
        month: new Date().getMonth() // Save current month to handle resets
      };
      
      await fetch(`${env.FIREBASE_DB_URL}/api_keys/${apiKey}.json?auth=${env.FIREBASE_DB_SECRET}`, {
        method: 'PUT',
        body: JSON.stringify(keyData)
      });
    }

    // 3. Return the key
    return new Response(JSON.stringify({ 
      status: "success", 
      api_key: apiKey 
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
}
