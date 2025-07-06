const firebaseConfig = {
  apiKey: "AIzaSyBKA3bxy1caa0QiGrn6AihtxufiO7xxTnI",
  authDomain: "futrshortener-7acf0.firebaseapp.com",
  databaseURL: "https://futrshortener-7acf0-default-rtdb.firebaseio.com",
  projectId: "futrshortener-7acf0",
  storageBucket: "futrshortener-7acf0.appspot.com",
  messagingSenderId: "863839648409",
  appId: "1:863839648409:web:d20ae154fe1c9dc1b19608",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
let currentUser = null;

// 🔐 Auth State
auth.onAuthStateChanged(user => {
  currentUser = user;
  document.getElementById("userIdDisplay").textContent = user ? `👤 ${user.displayName || user.email}` : "👤 Guest";
  document.querySelector("button[onclick='signInWithGoogle()']").style.display = user ? "none" : "inline-block";
  document.querySelector("button[onclick='signOut()']").style.display = user ? "inline-block" : "none";
  document.getElementById("myLinksSection").style.display = user ? "block" : "none";

  if (user) loadMyLinks();
});

// 🔐 Google Sign In / Out
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => alert("Auth error: " + err.message));
}
function signOut() {
  auth.signOut();
}

// 🔗 Shorten
function shorten() {
  let longUrl = document.getElementById("longUrl").value.trim();
  let alias = document.getElementById("customAlias").value.trim();
  const password = document.getElementById("linkPassword").value.trim();
  const expiryOpt = document.getElementById("expiry").value;
  const customExpiry = document.getElementById("customExpiry").value;

  if (!longUrl.startsWith("http")) longUrl = "https://" + longUrl;
  if (!isValidUrl(longUrl)) return updateResultBox("❌ Invalid URL", false);

  if (!alias) {
    alias = "link" + Math.floor(1000 + Math.random() * 9000);
    document.getElementById("customAlias").value = alias;
  }

  if (!alias.match(/^[a-zA-Z0-9_-]+$/)) {
    return updateResultBox("❌ Invalid alias characters", false);
  }

  const ref = db.ref("links/" + alias);
  showLoader(true);
  ref.once("value").then(snapshot => {
    if (snapshot.exists()) {
      showLoader(false);
      return updateResultBox("❌ Alias already taken", false);
    } else {
      const expiryTimestamp = getExpiryTimestamp(expiryOpt, customExpiry);
      const userId = currentUser ? currentUser.uid : "guest";

      ref.set({
        url: longUrl,
        password: password || null,
        createdAt: Date.now(),
        expiresAt: expiryTimestamp || null,
        userId
      }, error => {
        showLoader(false);
        if (error) return updateResultBox("❌ Save failed", false);
        const shortUrl = `${location.origin}/file/?alias=${alias}`;
        updateResultBox(`
          <div class="og-card">
            <div class="og-info">
              <h3>✅ Short Link Created</h3>
              <p>${shortUrl}</p>
              <div class="share-buttons">
                <a href="https://wa.me/?text=${encodeURIComponent(shortUrl)}" target="_blank">WhatsApp</a>
                <a href="https://t.me/share/url?url=${encodeURIComponent(shortUrl)}" target="_blank">Telegram</a>
                <a onclick="copyToClipboard('${shortUrl}')" style="cursor:pointer;">📋 Copy</a>
              </div>
            </div>
          </div>`, true);
        if (currentUser) loadMyLinks();
      });
    }
  });
}

// 🧠 Utils
function isValidUrl(url) {
  try { new URL(url); return true; } catch { return false; }
}
function getExpiryTimestamp(option, custom) {
  if (option === "custom" && custom) return new Date(custom).getTime();
  const now = Date.now();
  return {
    "1h": now + 3600000,
    "1d": now + 86400000,
    "7d": now + 604800000,
  }[option] || null;
}
function showLoader(show = true) {
  document.getElementById("loader").style.display = show ? "flex" : "none";
}
function updateResultBox(msg, isSuccess = true) {
  const box = document.getElementById("result");
  box.className = "result-box " + (isSuccess ? "success" : "error");
  box.innerHTML = msg;
}
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => alert("Copied!"));
}

// 📋 My Links
function loadMyLinks() {
  const uid = currentUser?.uid;
  db.ref("links").orderByChild("userId").equalTo(uid).once("value").then(snapshot => {
    const listDiv = document.getElementById("myLinksList");
    listDiv.innerHTML = "";
    snapshot.forEach(child => {
      const alias = child.key;
      const data = child.val();
      const url = data.url;
      const expires = data.expiresAt ? new Date(data.expiresAt).toLocaleString() : "Never";
      listDiv.innerHTML += `
        <div class="og-card">
          <div class="og-info">
            <h3>${alias}</h3>
            <p><a href="${url}" target="_blank">${url}</a></p>
            <small>Expires: ${expires}</small>
            <div>
              <button onclick="deleteLink('${alias}')">🗑️ Delete</button>
            </div>
          </div>
        </div>`;
    });
  });
}

function deleteLink(alias) {
  if (!confirm(`Delete link "${alias}"?`)) return;
  db.ref("links/" + alias).remove().then(() => loadMyLinks());
}

function handleExpiryChange() {
  document.getElementById("customExpiry").style.display =
    document.getElementById("expiry").value === "custom" ? "block" : "none";
}
