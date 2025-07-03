// === Firebase Init ===
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

// === Auth UI Logic ===
let mode = "login"; // or "signup"

function showLogin() {
  mode = "login";
  document.getElementById("authTitle").textContent = "Login";
  document.getElementById("authModal").style.display = "flex";
}
function showSignup() {
  mode = "signup";
  document.getElementById("authTitle").textContent = "Sign Up";
  document.getElementById("authModal").style.display = "flex";
}
function closeModal() {
  document.getElementById("authModal").style.display = "none";
}

function submitAuth() {
  const email = document.getElementById("authEmail").value;
  const pass = document.getElementById("authPassword").value;
  if (mode === "login") {
    auth.signInWithEmailAndPassword(email, pass).then(closeModal).catch(e => alert(e.message));
  } else {
    auth.createUserWithEmailAndPassword(email, pass).then(closeModal).catch(e => alert(e.message));
  }
}

auth.onAuthStateChanged(user => {
  const emailSpan = document.getElementById("userEmail");
  const authButtons = document.getElementById("authButtons");
  const userActions = document.getElementById("userActions");
  if (user) {
    emailSpan.textContent = `👤 ${user.email}`;
    authButtons.style.display = "none";
    userActions.style.display = "flex";
  } else {
    emailSpan.textContent = "👤 Guest";
    authButtons.style.display = "flex";
    userActions.style.display = "none";
  }
});

function logout() {
  auth.signOut();
}

// === URL Shortener with User Ownership ===
function shorten() {
  const user = auth.currentUser;
  let longUrl = document.getElementById("longUrl").value.trim();
  let alias = document.getElementById("customAlias").value.trim();
  const password = document.getElementById("linkPassword").value.trim();
  const expiryOpt = document.getElementById("expiry").value;
  const customExpiry = document.getElementById("customExpiry").value;
  const resultBox = document.getElementById("result");

  resultBox.className = "result-box";
  resultBox.innerHTML = "";

  if (!longUrl.startsWith("http")) longUrl = "https://" + longUrl;
  if (!isValidUrl(longUrl)) return updateResultBox("❌ Invalid URL", false);
  if (!alias) alias = "link" + Math.floor(1000 + Math.random() * 9000);
  if (!alias.match(/^[a-zA-Z0-9_-]+$/)) return updateResultBox("❌ Invalid alias", false);

  const ref = db.ref("links/" + alias);
  showLoader(true);

  ref.once("value").then(snapshot => {
    if (snapshot.exists()) {
      showLoader(false);
      updateResultBox("❌ Alias already exists", false);
    } else {
      const expiryTimestamp = getExpiryTimestamp(expiryOpt, customExpiry);
      const data = {
        url: longUrl,
        password: password || null,
        createdAt: Date.now(),
        expiresAt: expiryTimestamp || null,
        userId: user ? user.uid : null
      };

      ref.set(data, error => {
        showLoader(false);
        if (error) return updateResultBox("❌ Failed to save", false);

        if (user) {
          db.ref("users/" + user.uid + "/links/" + alias).set(true);
        }

        const shortUrl = `${location.origin}/?alias=${alias}`;
        updateResultBox(`
          <div class="og-card">
            <img src="https://api.apiflash.com/v1/urltoimage?access_key=b0e5bc53bdf0417eb10f041ec400ebaf&url=${encodeURIComponent(shortUrl)}" />
            <div class="og-info">
              <h3>Short Link Created!</h3>
              <p>${shortUrl}</p>
              <div class="share-buttons">
                <a href="https://wa.me/?text=${encodeURIComponent(shortUrl)}" target="_blank">WhatsApp</a>
                <a onclick="shareLink('${shortUrl}')" style="cursor:pointer;">More</a>
              </div>
            </div>
          </div>
          <button class="button" onclick="copyToClipboard('${shortUrl}')">Copy</button>
          <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(shortUrl)}&size=150x150" />
        `, true);
      });
    }
  });
}

// === My Links Loader ===
function loadMyLinks() {
  const user = auth.currentUser;
  if (!user) return alert("Login to view your links");

  db.ref("users/" + user.uid + "/links").once("value").then(snapshot => {
    const list = document.getElementById("myLinksList");
    list.innerHTML = "";
    snapshot.forEach(child => {
      const alias = child.key;
      const shortUrl = `${location.origin}/?alias=${alias}`;
      const li = document.createElement("li");
      li.innerHTML = `<a href="${shortUrl}" target="_blank">${shortUrl}</a>`;
      list.appendChild(li);
    });
    document.getElementById("myLinksBox").style.display = "block";
  });
}

// === Helpers ===
function showLoader(show = true) {
  document.getElementById("loader").style.display = show ? "flex" : "none";
}

function updateResultBox(message, isSuccess = true) {
  const box = document.getElementById("result");
  box.className = "result-box " + (isSuccess ? "success" : "error");
  box.innerHTML = message;
}

function isValidUrl(url) {
  try { new URL(url); return true; } catch { return false; }
}

function getExpiryTimestamp(option, custom) {
  if (option === "custom" && custom) return new Date(custom).getTime();
  const now = Date.now();
  switch (option) {
    case "1h": return now + 3600000;
    case "1d": return now + 86400000;
    case "7d": return now + 604800000;
    default: return null;
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => alert("Link copied!"));
}
function shareLink(link) {
  if (navigator.share) {
    navigator.share({ title: "Short Link", url: link });
  } else {
    alert("Share not supported");
  }
}
