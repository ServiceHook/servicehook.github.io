export async function onRequest(context) {
  const { request, env } = context;

  // =========================================================
  // 🔓 CORS HEADERS (The Fix)
  // This tells the browser: "It is okay to talk to this API."
  // =========================================================
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",  // Allow ANY website to use this
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
  };

  // 1. Handle "Preflight" Check (Browser asks permission first)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // 2. Only allow POST for the actual logic
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  // =========================================================
  // 🔗 API LOGIC
  // =========================================================
  const apiKey = request.headers.get("X-API-Key");

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing API Key" }), { 
      status: 401, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  try {
    // 3. Look up the API Key in Firebase
    const keyUrl = `${env.FIREBASE_DB_URL}/api_keys/${apiKey}.json?auth=${env.FIREBASE_DB_SECRET}`;
    const keyRes = await fetch(keyUrl);
    const keyData = await keyRes.json();

    if (!keyData) {
      return new Response(JSON.stringify({ error: "Invalid API Key" }), { 
        status: 403, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 4. Check Monthly Limit
    const currentMonth = new Date().getMonth();
    
    // Reset if new month
    if (keyData.month !== currentMonth) {
      keyData.usage = 0;
      keyData.month = currentMonth;
      await fetch(`${env.FIREBASE_DB_URL}/api_keys/${apiKey}/month.json?auth=${env.FIREBASE_DB_SECRET}`, { method: 'PUT', body: currentMonth });
      await fetch(`${env.FIREBASE_DB_URL}/api_keys/${apiKey}/usage.json?auth=${env.FIREBASE_DB_SECRET}`, { method: 'PUT', body: 0 });
    }

    if (keyData.usage >= 50) {
      return new Response(JSON.stringify({ error: "Monthly limit reached (50/50)" }), { 
        status: 429, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 5. Shorten URL
    const body = await request.json();
    if (!body.url) {
        return new Response("Missing URL", { 
            status: 400, 
            headers: corsHeaders 
        });
    }

    const slug = body.slug || Math.random().toString(36).substring(2, 8);
    
    await fetch(`${env.FIREBASE_DB_URL}/links/${slug}.json?auth=${env.FIREBASE_DB_SECRET}`, {
      method: 'PUT',
      body: JSON.stringify({ long_url: body.url, created_at: Date.now(), created_by: keyData.uid })
    });

    // 6. Increment Usage
    await fetch(`${env.FIREBASE_DB_URL}/api_keys/${apiKey}/usage.json?auth=${env.FIREBASE_DB_SECRET}`, {
      method: 'PUT',
      body: keyData.usage + 1
    });

    return new Response(JSON.stringify({
      status: "success",
      short_url: `https://jachu-url-shortener.pages.dev/${slug}`,
      usage: keyData.usage + 1,
      limit: 50
    }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
}
