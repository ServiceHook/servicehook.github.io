export async function onRequestPost(context) {
  const { request, env } = context;
  const apiKey = request.headers.get("X-API-Key");

  if (!apiKey) return new Response(JSON.stringify({ error: "Missing API Key" }), { status: 401 });

  try {
    // 1. Look up the API Key in Firebase
    const keyUrl = `${env.FIREBASE_DB_URL}/api_keys/${apiKey}.json?auth=${env.FIREBASE_DB_SECRET}`;
    const keyRes = await fetch(keyUrl);
    const keyData = await keyRes.json();

    if (!keyData) {
      return new Response(JSON.stringify({ error: "Invalid API Key" }), { status: 403 });
    }

    // 2. Check Monthly Limit & Reset if needed
    const currentMonth = new Date().getMonth();
    
    // If it's a new month, reset usage to 0
    if (keyData.month !== currentMonth) {
      keyData.usage = 0;
      keyData.month = currentMonth;
      // Update the month in DB immediately
      await fetch(`${env.FIREBASE_DB_URL}/api_keys/${apiKey}/month.json?auth=${env.FIREBASE_DB_SECRET}`, { method: 'PUT', body: currentMonth });
      await fetch(`${env.FIREBASE_DB_URL}/api_keys/${apiKey}/usage.json?auth=${env.FIREBASE_DB_SECRET}`, { method: 'PUT', body: 0 });
    }

    // Stop if limit reached
    if (keyData.usage >= 50) {
      return new Response(JSON.stringify({ error: "Monthly limit reached (50/50)" }), { status: 429 });
    }

    // 3. Shorten the URL
    const body = await request.json();
    if (!body.url) return new Response("Missing URL", { status: 400 });

    const slug = body.slug || Math.random().toString(36).substring(2, 8);
    
    // Save Link
    await fetch(`${env.FIREBASE_DB_URL}/links/${slug}.json?auth=${env.FIREBASE_DB_SECRET}`, {
      method: 'PUT',
      body: JSON.stringify({ long_url: body.url, created_at: Date.now(), created_by: keyData.uid })
    });

    // 4. Increment Usage
    await fetch(`${env.FIREBASE_DB_URL}/api_keys/${apiKey}/usage.json?auth=${env.FIREBASE_DB_SECRET}`, {
      method: 'PUT',
      body: keyData.usage + 1
    });

    return new Response(JSON.stringify({
      status: "success",
      short_url: `https://jachu.xyz/${slug}`,
      usage: keyData.usage + 1,
      limit: 50
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
