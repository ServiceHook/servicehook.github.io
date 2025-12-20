export async function onRequest(context) {
  const { request, env } = context;

  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    "Access-Control-Max-Age": "86400",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (request.method === "POST") {
    try {
      const apiKey = request.headers.get("X-API-Key");
      if (!apiKey) throw new Error("Missing API Key");

      // Verify Key
      const keyUrl = `${env.FIREBASE_DB_URL}/api_keys/${apiKey}.json?auth=${env.FIREBASE_DB_SECRET}`;
      const keyRes = await fetch(keyUrl);
      const keyData = await keyRes.json();

      if (!keyData) throw new Error("Invalid API Key");
      if (keyData.usage >= 50) throw new Error("Monthly limit reached");

      // Get Data
      const body = await request.json();
      if (!body.url) throw new Error("Missing URL");

      const slug = body.slug || Math.random().toString(36).substring(2, 8);
      
      // === FIX: Save to 'links' folder using 'url' key ===
      const saveUrl = `${env.FIREBASE_DB_URL}/links/${slug}.json?auth=${env.FIREBASE_DB_SECRET}`;
      
      await fetch(saveUrl, {
        method: 'PUT',
        body: JSON.stringify({ 
            url: body.url,        // <--- Uses 'url' key
            createdAt: Date.now(), 
            userId: keyData.uid 
        })
      });

      // Update Usage
      await fetch(`${env.FIREBASE_DB_URL}/api_keys/${apiKey}/usage.json?auth=${env.FIREBASE_DB_SECRET}`, {
        method: 'PUT',
        body: keyData.usage + 1
      });

      return new Response(JSON.stringify({
        status: "success",
        short_url: `https://jachu.xyz/${slug}`,
        usage: keyData.usage + 1
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
}
