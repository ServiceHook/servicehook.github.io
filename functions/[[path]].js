export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // 1. PASS-THROUGH (Files, API, Homepage)
  if (path.includes('.') || path.startsWith('/api/') || path.startsWith('/file/') || path === '/') {
    return env.ASSETS.fetch(request);
  }

  // 2. PAGE HANDLERS (Prevents Redirect Loops)
  if (path === '/legal') {
    return env.ASSETS.fetch(new Request(new URL('/legal.html', request.url), request));
  }
  if (path === '/admin') {
    return env.ASSETS.fetch(new Request(new URL('/file/admin.html', request.url), request));
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
      return serveHandler(env, request);
    }

    // Link Not Found -> Show 404
    return serveHandler(env, request);

  } catch (err) {
    return serveHandler(env, request);
  }
}

// Helper: Loads 404.html content in background
function serveHandler(env, request) {
  const pageUrl = new URL(request.url);
  pageUrl.pathname = "/404.html";
  return env.ASSETS.fetch(new Request(pageUrl, request));
}