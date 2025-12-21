export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 1. PASS-THROUGH (Files, API, Homepage, and Legal)
  // We let Cloudflare handle '/legal' naturally so it maps to legal.html without looping
  if (path.includes('.') || path.startsWith('/api/') || path.startsWith('/file/') || path === '/' || path === '/legal') {
    return env.ASSETS.fetch(request);
  }

  // 2. ADMIN PAGE HANDLER
  // Rewrite to '/file/admin' (no .html) to avoid Pretty URL redirects
  if (path === '/admin') {
    const adminUrl = new URL('/file/admin', request.url);
    return env.ASSETS.fetch(new Request(adminUrl, request));
  }

  // 3. SHORT LINK LOGIC
  const shortCode = path.replace('/', ''); 

  try {
    const dbUrl = `${env.FIREBASE_DB_URL}/links/${shortCode}.json?auth=${env.FIREBASE_DB_SECRET}`;
    const response = await fetch(dbUrl);
    const data = await response.json();

    if (data) {
      // Check Expiry & Auto-Delete
      if (data.expiresAt && Date.now() > data.expiresAt) {
        await fetch(dbUrl, { method: 'DELETE' });
        return serveHandler(env, request); // Show 404
      }

      // Valid Link: Load Handler (Rewrites URL to keep it pretty)
      return serveHandler(env, request, data.url); 
      // Note: If you have a specific handler for valid links (like an intermediate page), use it here.
      // If you intended to redirect immediately, use Response.redirect:
      // return Response.redirect(data.url, 302);
      
      // Based on your original code, it seems you might be using a rewrite to show a preview or just redirect.
      // If your original code was working for redirects, keep your logic. 
      // Assuming you want a standard 302 redirect for short links:
      return Response.redirect(data.url, 302); 
    }

    // Link Not Found -> Show 404
    return serveHandler(env, request);

  } catch (err) {
    return serveHandler(env, request);
  }
}

// Helper: Loads 404 content
function serveHandler(env, request) {
  const pageUrl = new URL(request.url);
  // FIX: Request '/404' instead of '/404.html' to prevent redirect loops
  pageUrl.pathname = "/404"; 
  return env.ASSETS.fetch(new Request(pageUrl, request));
}