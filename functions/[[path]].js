export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // =========================================================
  // 1. EXCLUSIONS (API, Files, Legal, Admin)
  // =========================================================
  
  // Explicitly handle "Legal" to prevent 404s
  if (path === "/legal" || path === "/legal.html") {
    // Force load the legal.html file
    const legalUrl = new URL(request.url);
    legalUrl.pathname = "/legal.html";
    return env.ASSETS.fetch(new Request(legalUrl, request));
  }

  // Allow standard files and API paths to pass through
  if (path.startsWith("/api/") || 
      path.startsWith("/file/") || 
      path.includes(".") || 
      path === "/") {
    return env.ASSETS.fetch(request);
  }

  // =========================================================
  // 2. SHORT LINK LOGIC
  // =========================================================
  
  const shortCode = params.path[0];

  try {
    const dbUrl = `${env.FIREBASE_DB_URL}/links/${shortCode}.json?auth=${env.FIREBASE_DB_SECRET}`;
    const response = await fetch(dbUrl);

    // If Firebase fails or returns null
    if (!response.ok) return serve404(env, request);
    
    const data = await response.json();

    // Link doesn't exist? Show 404 Page.
    if (!data) return serve404(env, request);

    // --- CHECK EXPIRATION & AUTO-DELETE ---
    if (data.expiresAt && Date.now() > data.expiresAt) {
      // 🗑️ Link Expired: Delete from DB immediately
      await fetch(dbUrl, { method: 'DELETE' });
      return serve404(env, request);
    }

    // --- VALID LINK FOUND ---
    // Instead of redirecting instantly (which skips password/analytics),
    // we "Rewrite" to 404.html. This keeps the URL as jachu.xyz/alias
    // but loads the HTML that handles the Password UI and Redirection logic.
    return serve404(env, request);

  } catch (err) {
    return serve404(env, request);
  }
}

// Helper to serve the "Wait/Redirect" page (404.html)
function serve404(env, request) {
  const pageUrl = new URL(request.url);
  pageUrl.pathname = "/404.html";
  return env.ASSETS.fetch(new Request(pageUrl, request));
}