export async function onRequestGet(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  // =========================================================
  // 🛑 SAFETY BLOCK: IGNORE STATIC FILES
  // If the URL ends in .css, .js, .ico, or .png, 
  // let Cloudflare serve the file directly. DO NOT RUN DB LOGIC.
  // =========================================================
  if (url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|ico|json)$/)) {
    return env.ASSETS.fetch(request);
  }
  
  // EXTRA SAFETY: Explicitly check for your main files
  if (url.pathname === "/styles.css" || url.pathname === "/script.js") {
    return env.ASSETS.fetch(request);
  }

  // =========================================================
  // 🔗 SHORTNER LOGIC STARTS HERE
  // =========================================================
  
  // If path is empty (Homepage), show index.html
  if (!params.path || params.path.length === 0) {
    return env.ASSETS.fetch(request);
  }

  const shortCode = params.path[0];

  try {
    // 1. Check Firebase
    const dbUrl = `${env.FIREBASE_DB_URL}/links/${shortCode}.json`;
    const response = await fetch(dbUrl);

    if (!response.ok) {
       return env.ASSETS.fetch(request); 
    }

    const data = await response.json();

    // 2. Redirect if found
    if (data && data.long_url) {
      return Response.redirect(data.long_url, 302);
    }

    // 3. If not found, redirect to home
    return Response.redirect(url.origin, 302);

  } catch (err) {
    // On crash, show homepage
    return env.ASSETS.fetch(request);
  }
}
