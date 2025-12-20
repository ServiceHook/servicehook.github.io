export async function onRequestGet(context) {
  const { request, env, params } = context;
  
  // === FIX IS HERE ===
  // Safely check if we are on the homepage. 
  // If params.path is missing or empty, just show the website (index.html).
  if (!params.path || params.path.length === 0) {
    return env.ASSETS.fetch(request);
  }

  const shortCode = params.path[0];

  // Double check: if it's a file request (like style.css or script.js), ignore it
  if (shortCode.includes(".")) {
    return env.ASSETS.fetch(request);
  }

  try {
    // 1. Check Firebase
    const dbUrl = `${env.FIREBASE_DB_URL}/links/${shortCode}.json`;
    const response = await fetch(dbUrl);
    
    // Check if Firebase actually replied
    if (!response.ok) {
       return env.ASSETS.fetch(request); // Fallback to 404/Home if DB fails
    }

    const data = await response.json();

    // 2. Redirect if found
    if (data && data.long_url) {
      return Response.redirect(data.long_url, 302);
    }

    // 3. If not found, go to homepage (or 404 page)
    return Response.redirect(new URL(request.url).origin, 302);

  } catch (err) {
    // If anything crashes, just show the homepage instead of an error page
    return env.ASSETS.fetch(request);
  }
}
