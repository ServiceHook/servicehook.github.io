export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  
  // =========================================================
  // 🛑 WHITELIST: IGNORE API, FILES, AND ASSETS
  // =========================================================

  // 1. Ignore your API pages (e.g., /api/dashboard.html)
  if (url.pathname.startsWith("/api/")) {
    return env.ASSETS.fetch(request);
  }

  // 2. Ignore your Asset folder (e.g., /file/styles.css)
  // This is the CRITICAL fix for your CSS/JS
  if (url.pathname.startsWith("/file/")) {
    return env.ASSETS.fetch(request);
  }

  // 3. Ignore file extensions (extra safety)
  if (url.pathname.includes(".")) {
    return env.ASSETS.fetch(request);
  }

  // 4. Ignore Homepage
  if (url.pathname === "/" || !params.path || params.path.length === 0) {
    return env.ASSETS.fetch(request);
  }

  // =========================================================
  // 🔗 SHORTENER LOGIC
  // =========================================================
  
  const shortCode = params.path[0];

  try {
    const dbUrl = `${env.FIREBASE_DB_URL}/links/${shortCode}.json`;
    const response = await fetch(dbUrl);

    if (!response.ok) {
       return env.ASSETS.fetch(request); 
    }

    const data = await response.json();

    if (data && data.long_url) {
      return Response.redirect(data.long_url, 302);
    }

    return Response.redirect(url.origin, 302);

  } catch (err) {
    return env.ASSETS.fetch(request);
  }
}
