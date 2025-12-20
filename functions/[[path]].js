export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  // 1. If the path is empty (Homepage), just show the site
  if (!params.path || params.path.length === 0) {
    return env.ASSETS.fetch(request);
  }

  const shortCode = params.path[0];

  // === THE FIX IS HERE ===
  // If the path contains a dot (like style.css or script.js), 
  // it is a file, NOT a short link. Let Cloudflare serve it normally.
  if (shortCode.includes('.')) {
    return env.ASSETS.fetch(request);
  }
  // =======================

  try {
    // 2. Check Firebase for the short link
    const dbUrl = `${env.FIREBASE_DB_URL}/links/${shortCode}.json`;
    const response = await fetch(dbUrl);
    
    // If Firebase errors out, just show the homepage
    if (!response.ok) {
       return env.ASSETS.fetch(request); 
    }

    const data = await response.json();

    // 3. Redirect if found
    if (data && data.long_url) {
      return Response.redirect(data.long_url, 302);
    }

    // 4. If not found, redirect to home
    return Response.redirect(url.origin, 302);

  } catch (err) {
    return env.ASSETS.fetch(request);
  }
}
