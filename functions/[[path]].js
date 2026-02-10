export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 1. PASS-THROUGH (Files, API, Homepage, and Legal)
  // We let Cloudflare handle specific paths naturally
  if (path.includes('.') || path.startsWith('/api/') || path.startsWith('/file/') || path === '/' || path === '/legal' || path === '/my-links' || path === '/donate' || path === '/download') {
    return env.ASSETS.fetch(request);
  }

  // 2. ADMIN PAGE HANDLER
  // Rewrite '/admin' to '/file/admin.html'
  if (path === '/admin') {
    const adminUrl = new URL('/file/admin.html', request.url);
    return env.ASSETS.fetch(adminUrl);
  }

  // 3. SHORT LINK LOGIC
  const shortCode = path.replace(/^\//, ''); // Remove leading slash

  try {
    const dbUrl = `${env.FIREBASE_DB_URL}/links/${shortCode}.json?auth=${env.FIREBASE_DB_SECRET}`;
    const response = await fetch(dbUrl);
    
    // Handle Firebase errors gracefully
    if (!response.ok) {
       return serve404(env, request);
    }

    const data = await response.json();

    if (data) {
      // Check Expiry & Auto-Delete
      if (data.expiresAt && Date.now() > data.expiresAt) {
        await fetch(dbUrl, { method: 'DELETE' });
        return serve404(env, request); // Link Expired
      }

      // HANDLE PASSWORD PROTECTION
      // If password exists, we rewrite to 404.html so the client-side JS can handle the unlock UI
      if (data.password) {
        return serve404(env, request);
      }

      // Standard Redirect (Fastest)
      return Response.redirect(data.url, 302);
    }

    // Link Not Found -> Show 404
    return serve404(env, request);

  } catch (err) {
    // Log error for debugging in "npm run dev" console
    console.error("Shortener Error:", err);
    // Return safe 404 instead of crashing
    return serve404(env, request);
  }
}

// Helper: Loads 404 content safely
function serve404(env, request) {
  const pageUrl = new URL(request.url);
  pageUrl.pathname = "/404.html"; 
  
  // FIX: Pass only the URL to avoid Request body/stream locking issues
  return env.ASSETS.fetch(pageUrl);
}
