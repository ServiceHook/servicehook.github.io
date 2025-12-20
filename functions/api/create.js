export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Security Check
  const apiKey = request.headers.get("X-API-Key");
  if (apiKey !== env.API_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { url, slug } = await request.json();
    if (!url) return new Response("Missing URL", { status: 400 });

    // 2. Generate Slug (if not provided)
    const finalSlug = slug || Math.random().toString(36).substring(2, 8);

    // 3. Save to Firebase
    // Note: ?auth= is required to write to the DB securely
    const dbUrl = `${env.FIREBASE_DB_URL}/links/${finalSlug}.json?auth=${env.FIREBASE_DB_SECRET}`;

    await fetch(dbUrl, {
      method: 'PUT',
      body: JSON.stringify({ long_url: url, created_at: Date.now() })
    });

    // 4. Return Success
    return new Response(JSON.stringify({
      status: "success",
      short_url: `https://jachu.xyz/${finalSlug}`,
      slug: finalSlug
    }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
}
