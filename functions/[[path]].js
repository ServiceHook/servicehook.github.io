export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  // =========================================================
  // 🛑 WHITELIST: IGNORE API, FILES, AND HOMEPAGE
  // =========================================================

  // 1. If asking for API, let the API script handle it
  if (url.pathname.startsWith("/api/")) {
    return env.ASSETS.fetch(request);
  }

  // 2. If asking for a file (css, js, png), just show it
  if (url.pathname.startsWith("/file/") || url.pathname.includes(".")) {
    return env.ASSETS.fetch(request);
  }

  // 3. If asking for the Homepage, show index.html
  if (url.pathname === "/" || !params.path || params.path.length === 0) {
    return env.ASSETS.fetch(request);
  }

  // =========================================================
  // 🔗 SHORTENER LOGIC (Redirects)
  // =========================================================
  
  const shortCode = params.path[0];

  try {
    // Check the 'links' folder in Firebase
    const dbUrl = `${env.FIREBASE_DB_URL}/links/${shortCode}.json`;
    const response = await fetch(dbUrl);

    if (!response.ok) {
       return env.ASSETS.fetch(request); 
    }

    const data = await response.json();

    // Redirect if we found a URL
    if (data && data.url) {
      return Response.redirect(data.url, 302);
    }

    // If link not found, go to homepage
    return Response.redirect(url.origin, 302);

  } catch (err) {
    // If error, just show homepage
    return env.ASSETS.fetch(request);
  }
}
