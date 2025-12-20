export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  
  // 🛑 WHITELIST (Ignore system files)
  if (url.pathname.includes("/api/") || url.pathname.includes(".") || url.pathname === "/") {
    return env.ASSETS.fetch(request);
  }

  const shortCode = params.path[0];

  try {
    // === FIX 1: Check ROOT (Removed /links/) ===
    const dbUrl = `${env.FIREBASE_DB_URL}/${shortCode}.json`;
    const response = await fetch(dbUrl);

    if (!response.ok) {
       return env.ASSETS.fetch(request); 
    }

    const data = await response.json();

    // === FIX 2: Check for "url" key ===
    if (data && data.url) {
      return Response.redirect(data.url, 302);
    }

    return Response.redirect(url.origin, 302);

  } catch (err) {
    return env.ASSETS.fetch(request);
  }
}
