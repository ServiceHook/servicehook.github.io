# 🔗 Jachu URL Shortener

**Jachu** is a professional, high-performance URL shortener service. This repository serves as the official documentation for developers integrating the **Jachu API** into their applications.

**Live Service:** [https://jachu.xyz](https://jachu.xyz)

![Status](https://img.shields.io/badge/status-active-success.svg)
![API](https://img.shields.io/badge/API-Public-blue)
![License](https://img.shields.io/badge/license-Proprietary-red)

---

## 🚀 About Jachu

Jachu is a cloud-native URL shortening service built for speed and reliability. It runs on the Cloudflare Edge Network, ensuring redirects happen in milliseconds, no matter where your users are located.

* **⚡ Edge Network:** Redirects process globally in <50ms.
* **🛡️ Secure:** Enterprise-grade security with rate limiting.
* **🔑 Developer Friendly:** Simple REST API for easy integration.

---

## 📖 API Documentation

You can use the Jachu API to programmatically shorten links from your own website, app, or browser extension.

### 1. Base URL
POST `https://jachu.xyz/api/create`

### 2. Authentication
An API Key is required. You can generate one for free by visiting the [Developer Dashboard](https://jachu.xyz/api/dashboard.html).

* **Header Name:** `X-API-Key`
* **Value:** `YOUR_UNIQUE_API_KEY`

### 3. Request Body (JSON)
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `url` | string | **Yes** | The long URL you want to shorten (must include `http://` or `https://`). |
| `slug` | string | No | A custom alias (e.g., `mysite`). If omitted, a random 6-char code is generated. |

**Example Request:**
```json
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

💻 Code Example (JavaScript)
Copy this function to use Jachu in your project:

```
async function shortenLink(longUrl, apiKey) {
  try {
    const response = await fetch('[https://jachu.xyz/api/create](https://jachu.xyz/api/create)', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ url: longUrl })
    });

    const data = await response.json();
    
    if (data.status === "success") {
      return data.short_url;
    } else {
      console.error("Shortener Error:", data.error);
      return null;
    }
  } catch (err) {
    console.error("Network Error:", err);
  }
}
```
🔒 Copyright & License
© 2025 Jachu.xyz. All Rights Reserved.

This source code is Proprietary. You MAY use the API endpoint in your own applications. You MAY NOT copy, clone, host, or redistribute this codebase to run a competing service.

### 16. `.gitignore`

```text
.wrangler
node_modules
package-lock.json
package.json
.dev.vars
.DS_Store