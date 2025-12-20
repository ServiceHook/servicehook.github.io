🔗 Jachu URL ShortenerJachu is a powerful, serverless URL shortener built with Cloudflare Pages, Firebase Realtime Database, and plain HTML/JS. It features a robust API, developer dashboard, usage limits, and blazing-fast redirects.Live Demo: https://jachu.xyz🚀 Features⚡ Serverless Architecture: Runs entirely on Cloudflare Pages Functions (Edge Network).🗄️ Realtime Database: Stores links securely in Firebase.🔑 Public API: Developers can generate API keys to integrate shortening into their apps.🛡️ Rate Limiting: Built-in limits (e.g., 50 requests/month) per API key to prevent abuse.📊 Developer Dashboard: A dedicated UI for users to manage their API keys.📁 Clean Structure: Organized assets and routing for a professional feel.🛠️ Tech StackFrontend: HTML5, CSS3, JavaScript (Vanilla)Backend: Cloudflare Pages Functions (Node.js/Workers runtime)Database: Firebase Realtime DatabaseAuthentication: Firebase Auth (Google Sign-In)📖 API DocumentationIntegrate Jachu Shortener into your own website or application.1. Base URLPOST https://jachu.xyz/api/create
2. AuthenticationYou must include your API Key in the request header.Header Name: X-API-KeyValue: YOUR_UNIQUE_API_KEY3. Request Body (JSON)ParameterTypeRequiredDescriptionurlstringYesThe long URL you want to shorten (must include http:// or https://).slugstringNoA custom alias (e.g., mysite). If omitted, a random 6-char code is generated.Example Request:JSON{
  "url": "https://www.google.com/search?q=javascript",
  "slug": "googlesearch"
}
4. Response (JSON)Success (200 OK):JSON{
  "status": "success",
  "short_url": "https://jachu.xyz/googlesearch",
  "usage": 12,
  "limit": 50
}
Error (400/401/429):JSON{
  "error": "Monthly limit reached (50/50)"
}
5. Implementation Example (HTML/JS)Copy this code to add a shortener tool to your site:HTML<script>
async function createShortLink() {
  const apiKey = "YOUR_API_KEY_HERE";
  const longUrl = "https://example.com";

  const response = await fetch('https://jachu.xyz/api/create', {
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
⚙️ Installation (Self-Host Guide)Want to run your own version of Jachu? Follow these steps.Step 1: Firebase SetupGo to Firebase Console and create a project.Database: Create a Realtime Database. Set rules to read: true, write: true (or secure them for production).Auth: Enable Authentication and turn on the Google provider.Web App: In Project Settings, register a "Web App" to get your firebaseConfig.Step 2: Cloudflare Pages SetupFork this repository to your GitHub.Log in to Cloudflare Dashboard.Go to Workers & Pages > Create Application > Pages > Connect to Git.Select your repo.Build Settings:Framework: NoneBuild command: exit 0Output directory: .Step 3: Environment VariablesIn Cloudflare Pages Settings > Environment variables, add these secrets:Variable NameValueWhere to find itFIREBASE_DB_URLhttps://your-project.firebaseio.comFirebase Console > Realtime DatabaseFIREBASE_DB_SECRETAbCdEf12345...Project Settings > Service Accounts > Database SecretsFIREBASE_WEB_API_KEYAIzaSy...Project Settings > General > Web API KeyStep 4: DeployGo to the Deployments tab in Cloudflare and click Retry deployment. Your site is now live!📂 Project StructureBash/
├── index.html              # Main Landing Page
├── 404.html                # Fallback Page
├── file/                   # Static Assets
│   ├── styles.css          # Main Stylesheet
│   └── script.js           # Frontend Logic
├── api/
│   └── dashboard.html      # Developer Dashboard (Get API Key)
└── functions/              # Backend (Cloudflare Workers)
    ├── [[path]].js         # Main Router (Handles Redirects)
    └── api/
        ├── create.js       # Endpoint: Shorten URL
        └── generate_key.js # Endpoint: Create User API Key
🤝 ContributingContributions are welcome!Fork the project.Create your feature branch (git checkout -b feature/AmazingFeature).Commit your changes (git commit -m 'Add some AmazingFeature').Push to the branch (git push origin feature/AmazingFeature).Open a Pull Request.📄 LicenseDistributed under the MIT License. See LICENSE for more information.Built with ❤️ by Jachu
