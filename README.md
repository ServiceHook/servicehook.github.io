# 🔗 Jachu URL Shortener

**Jachu** is a powerful, serverless URL shortener built with **Cloudflare Pages**, **Firebase Realtime Database**, and plain HTML/JS. It features a robust API, developer dashboard, usage limits, and blazing-fast redirects.

**Live Demo:** [https://jachu.xyz](https://jachu.xyz)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)
![Platform](https://img.shields.io/badge/platform-Cloudflare%20Pages-orange)

---

## 🚀 Features

* **⚡ Serverless Architecture:** Runs entirely on Cloudflare Pages Functions (Edge Network).
* **🗄️ Realtime Database:** Stores links securely in Firebase.
* **🔑 Public API:** Developers can generate API keys to integrate shortening into their apps.
* **🛡️ Rate Limiting:** Built-in limits (e.g., 50 requests/month) per API key to prevent abuse.
* **📊 Developer Dashboard:** A dedicated UI for users to manage their API keys.
* **📁 Clean Structure:** Organized assets and routing for a professional feel.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
* **Backend:** Cloudflare Pages Functions (Node.js/Workers runtime)
* **Database:** Firebase Realtime Database
* **Authentication:** Firebase Auth (Google Sign-In)

---

## 📖 API Documentation

Integrate Jachu Shortener into your own website or application.

### 1. Base URL
POST https://jachu.xyz/api/create

### 2. Authentication
You must include your API Key in the request header.
* **Header Name:** `X-API-Key`
* **Value:** `YOUR_UNIQUE_API_KEY`

### 3. Request Body (JSON)
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `url` | string | **Yes** | The long URL you want to shorten (must include `http://` or `https://`). |
| `slug` | string | No | A custom alias (e.g., `mysite`). If omitted, a random 6-char code is generated. |

**Example Request:**
json
{
  "url": "[https://www.google.com/search?q=javascript](https://www.google.com/search?q=javascript)",
  "slug": "googlesearch"
}
4. Response (JSON)
Success (200 OK):

{
  "status": "success",
  "short_url": "[https://jachu.xyz/googlesearch](https://jachu.xyz/googlesearch)",
  "usage": 12,
  "limit": 50
}
Error (400/401/429):
{
  "error": "Monthly limit reached (50/50)"
}

5. Implementation Example (HTML/JS)
Copy this code to add a shortener tool to your site:
```
<script>
async function createShortLink() {
  const apiKey = "YOUR_API_KEY_HERE";
  const longUrl = "[https://example.com](https://example.com)";

  const response = await fetch('[https://jachu.xyz/api/create](https://jachu.xyz/api/create)', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify({ url: longUrl })
  });

  const data = await response.json();
  if(data.status === "success") {
    console.log("Short Link:", data.short_url);
  } else {
    console.error("Error:", data.error);
  }
}
</script>

```
