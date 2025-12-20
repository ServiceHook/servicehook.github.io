export async function onRequest(context) {
  const { request, env } = context;

  // 1. Define Standard Headers (The "Permission Slip")
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    "Access-Control-Max-Age": "86400", // Cache this permission for 1 day
  };

  // 2. Handle Preflight (The Browser's Check)
  // If the browser asks "Can I post?", we say "YES" immediately.
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  // 3. Handle the Actual Request
  if (request.method === "POST") {
    try {
      const apiKey = request.headers.get("X-API-Key");

      // --- Security & Validation ---
      if (!apiKey) throw new Error("Missing API Key");

      // Check Firebase for Key
      const keyUrl = `${env.FIREBASE_DB_URL}/api_keys/${apiKey}.json?auth=${env.FIREBASE_DB_SECRET}`;
      const keyRes = await fetch(keyUrl);
      const keyData = await keyRes.json();

      if (!keyData) throw new Error("Invalid API Key");
      if (keyData.usage >= 50) throw new Error("Monthly limit reached");

      // --- Create Link ---
      const body = await request.json();
      if (!body.url) throw new Error("Missing URL");

      const slug = body.slug || Math.random().toString(36).substring(2, 8);
      
      // Save to Firebase
      await fetch(`${env.FIREBASE_DB_URL}/links/${slug}.json?auth=${env.FIREBASE_DB_SECRET}`, {
        method: 'PUT',
        body: JSON.stringify({ long_url: body.url, created_at: Date.now(), created_by: keyData.uid })
      });

      // Update Usage
      await fetch(`${env.FIREBASE_DB_URL}/api_keys/${apiKey}/usage.json?auth=${env.FIREBASE_DB_SECRET}`, {
        method: 'PUT',
        body: keyData.usage + 1
      });

      // --- Success Response ---
      return new Response(JSON.stringify({
        status: "success",
        short_url: `https://jachu.xyz/${slug}`,
        usage: keyData.usage + 1
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      // --- Error Response (MUST have CORS headers too) ---
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // 4. Block anything else
  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
}
