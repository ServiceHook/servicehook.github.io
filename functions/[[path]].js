export async function onRequestGet(context) {
  const { request, env, params } = context;
  
  // 1. If Homepage, show index.html
  if (!params.path || params.path.length === 0) {
    return env.ASSETS.fetch(request);
  }

  const shortCode = params.path[0];

  // =========================================================
  // 🛑 WHITELIST: IGNORE DASHBOARD & FILES
  // =========================================================
  
  // A. Allow specific page names (Fixes the issue if URL is just /dashboard)
  // Add any other HTML filenames here (without .html)
  const protectedPages = ["dashboard", "404", "login", "register"]; 
  if (protectedPages.includes(shortCode)) {
    return env.ASSETS.fetch(request);
  }

  // B. Allow files with extensions (styles.css, script.js, dashboard.html)
  // If it has a DOT, it is a file.
  if (shortCode.includes('.')) {
     return env.ASSETS.fetch(request);
  }

  // =========================================================
  // 🔗 SHORTENER LOGIC
  // =========================================================

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

    // Default to home if not found
    return Response.redirect(new URL(request.url).origin, 302);

  } catch (err) {
    return env.ASSETS.fetch(request);
  }
}
