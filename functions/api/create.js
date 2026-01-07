export async function onRequest(context) {
  const { request, env } = context;

  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

      // 1. Verify API Key
      const keyUrl = `${env.FIREBASE_DB_URL}/api_keys/${apiKey}.json?auth=${env.FIREBASE_DB_SECRET}`;
      const keyRes = await fetch(keyUrl);
      const keyData = await keyRes.json();

      if (!keyData) throw new Error("Invalid API Key");
      if (keyData.usage >= keyData.limit) throw new Error("Monthly limit reached");

      // 2. Validate URL
      const body = await request.json();
      if (!body.url) throw new Error("Missing URL parameter");

      // 🛑 SECURITY: Prevent self-shortening (Loops)
      const blockedDomains = ["jachu.xyz", "servicehook.github.io"];
      try {
        const targetUrlObj = new URL(body.url);
        if (blockedDomains.some(domain => targetUrlObj.hostname.includes(domain))) {
           throw new Error("Cannot shorten links from this domain.");
        }
      } catch (e) {
        throw new Error("Invalid URL format provided.");
      }

      // 3. Generate Slug (Custom or Random)
      let slug = body.slug ? body.slug.trim() : Math.random().toString(36).substring(2, 8);
      
      // 4. Save to Database
      const saveUrl = `${env.FIREBASE_DB_URL}/links/${slug}.json?auth=${env.FIREBASE_DB_SECRET}`;
      
      // NEW: Extract extra fields from request body
      const payload = { 
          url: body.url,
          createdAt: Date.now(), 
          userId: keyData.uid,
          source: "api"
      };

      // Add Password if provided
      if (body.password) payload.password = body.password;

      // Add Expiry if provided (Expects timestamp in milliseconds)
      if (body.expiresAt) payload.expiresAt = body.expiresAt;

      await fetch(saveUrl, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      // 5. Increment Usage (Optimistic)
      await fetch(`${env.FIREBASE_DB_URL}/api_keys/${apiKey}/usage.json?auth=${env.FIREBASE_DB_SECRET}`, {
        method: 'PUT',
        body: (keyData.usage || 0) + 1
      });

      // Determine Base URL (Dynamic)
      const baseUrl = new URL(request.url).origin;

      return new Response(JSON.stringify({
        status: "success",
        short_url: `${baseUrl}/${slug}`,
        usage: (keyData.usage || 0) + 1,
        limit: keyData.limit
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ status: "error", message: err.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
}
