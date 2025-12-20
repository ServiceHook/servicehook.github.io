export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  // =========================================================
  // 🛑 SAFETY BLOCK: IGNORE ALL STATIC FILES
  // Added 'html' to this list so dashboard.html loads correctly
  // =========================================================
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|ico|json|html)$/)) {
    return env.ASSETS.fetch(request);
  }

  // =========================================================
  // 🔗 SHORTENER LOGIC
  // =========================================================
  
  if (!params.path || params.path.length === 0) {
    return env.ASSETS.fetch(request);
  }

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

    // Default to home if not found
    return Response.redirect(url.origin, 302);

  } catch (err) {
    return env.ASSETS.fetch(request);
  }
}
