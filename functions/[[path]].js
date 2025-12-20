export async function onRequestGet(context) {
  const { request, env, params } = context;

  // 1. Get the short code from the URL (e.g., "abc1")
  const shortCode = params.path[0];

  // If user visits the homepage (no code), show index.html
  if (!shortCode) {
    return env.ASSETS.fetch(request);
  }

  // 2. Check Firebase for the link
  // We use the REST API so we don't need the huge Firebase SDK
  const dbUrl = `${env.FIREBASE_DB_URL}/links/${shortCode}.json`;

  const response = await fetch(dbUrl);
  const data = await response.json();

  // 3. Redirect if found
  if (data && data.long_url) {
    return Response.redirect(data.long_url, 302);
  }

  // 4. If not found, redirect to home
  return Response.redirect(new URL(request.url).origin, 302);
}
