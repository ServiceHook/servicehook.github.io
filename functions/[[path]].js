export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // =========================================================
  // 🛑 WHITELIST: IGNORE API, FILES, AND SPECIFIC PAGES
  // =========================================================

  // 1. API Requests
  if (path.startsWith("/api/")) {
    return env.ASSETS.fetch(request);
  }

  // 2. Static Files (CSS, JS, Images, HTML files with extension)
  if (path.startsWith("/file/") || path.includes(".")) {
    return env.ASSETS.fetch(request);
  }

  // 3. Explicitly Exclude "Legal" and "Admin" pages
  // This allows accessing /legal without it being treated as a short link
  const excludedPaths = ["/legal", "/legal.html", "/admin", "/404"];
  if (excludedPaths.includes(path)) {
    return env.ASSETS.fetch(request);
  }

  // 4. Homepage
  if (path === "/" || !params.path || params.path.length === 0) {
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

    // If link not found, go to homepage (or custom 404)
    return Response.redirect(url.origin + "/404.html", 302);

  } catch (err) {
    // If error, just show homepage
    return env.ASSETS.fetch(request);
  }
}