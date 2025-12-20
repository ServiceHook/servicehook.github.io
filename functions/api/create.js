export async function onRequest(context) {
  const { request, env } = context;

  // =========================================================
  // 🔓 CORS HEADERS
  // =========================================================
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
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
    // 1. Authenticate User
    const keyUrl = `${env.FIREBASE_DB_URL}/api_keys/${apiKey}.json?auth=${env.FIREBASE_DB_SECRET}`;
    const keyRes = await fetch(keyUrl);
    const keyData = await keyRes.json();

    if (!keyData) {
      return new Response(JSON.stringify({ error: "Invalid API Key" }), { 
        status: 403, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 2. Check Limits
    const currentMonth = new Date().getMonth();
    if (keyData.month !== currentMonth) {
      keyData.usage = 0;
      keyData.month = currentMonth;
      await fetch(`${env.FIREBASE_DB_URL}/api_keys/${apiKey}/month.json?auth=${env.FIREBASE_DB_SECRET}`, { method: 'PUT', body: currentMonth });
      await fetch(`${env.FIREBASE_DB_URL}/api_keys/${apiKey}/usage.json?auth=${env.FIREBASE_DB_SECRET}`, { method: 'PUT', body: 0 });
    }

    if (keyData.usage >= 50) {
      return new Response(JSON.stringify({ error: "Monthly limit reached" }), { 
        status: 429, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 3. Process URL
    const body = await request.json();
    if (!body.url) {
        return new Response("Missing URL", { status: 400, headers: corsHeaders });
    }

    const slug = body.slug || Math.random().toString(36).substring(2, 8);
    
    // 4. Save to Main Database (Correct Path: /links/)
    await fetch(`${env.FIREBASE_DB_URL}/links/${slug}.json?auth=${env.FIREBASE_DB_SECRET}`, {
      method: 'PUT',
      body: JSON.stringify({ long_url: body.url, created_at: Date.now(), created_by: keyData.uid })
    });

    // 5. Update Usage
    await fetch(`${env.FIREBASE_DB_URL}/api_keys/${apiKey}/usage.json?auth=${env.FIREBASE_DB_SECRET}`, {
      method: 'PUT',
      body: keyData.usage + 1
    });

    // 6. Return Response (UPDATED DOMAIN HERE)
    return new Response(JSON.stringify({
      status: "success",
      short_url: `https://jachu.xyz/${slug}`, // <--- CHANGED THIS LINE
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
