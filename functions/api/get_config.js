export async function onRequest(context) {
  const { env } = context;

  // Only return safe, public keys to the browser
  const config = {
    razorpayKeyId: env.RAZORPAY_KEY_ID, // <--- Added this line
    firebase: {
      apiKey: env.FIREBASE_API_KEY,
      authDomain: env.FIREBASE_AUTH_DOMAIN,
      databaseURL: env.FIREBASE_DB_URL,
      projectId: env.FIREBASE_PROJECT_ID,
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.FIREBASE_SENDER_ID,
      appId: env.FIREBASE_APP_ID
    },
    // We send the admin email so the frontend knows who is admin
    adminEmail: env.ADMIN_EMAIL 
  };

  return new Response(JSON.stringify(config), {
    headers: { 
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600" 
    }
  });
}