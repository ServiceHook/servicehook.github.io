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

auth.onAuthStateChanged(user => {
  currentUser = user;
  document.getElementById("userIdDisplay").textContent = user
    ? `👤 ${user.email || user.uid}`
    : "👤 Guest";

  document.querySelector('#authButtons button[onclick="toggleAuthModal()"]').style.display = user ? "none" : "inline-block";
  document.querySelector('#authButtons button[onclick="signOut()"]').style.display = user ? "inline-block" : "none";
});

function toggleAuthModal() {
  const modal = document.getElementById("authModal");
  modal.style.display = modal.style.display === "flex" ? "none" : "flex";
}

function signUp() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  auth.createUserWithEmailAndPassword(email, password)
    .then(() => toggleAuthModal())
    .catch(err => alert("❌ " + err.message));
}

function signIn() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  auth.signInWithEmailAndPassword(email, password)
    .then(() => toggleAuthModal())
    .catch(err => alert("❌ " + err.message));
}

function signOut() {
  auth.signOut();
}

function handleExpiryChange() {
  const expiry = document.getElementById("expiry").value;
  document.getElementById("customExpiry").style.display = expiry === "custom" ? "block" : "none";
}

function showLoader(show = true) {
  document.getElementById("loader").style.display = show ? "flex" : "none";
}

function updateResultBox(message, isSuccess = true) {
  const box = document.getElementById("result");
  box.className = "result-box " + (isSuccess ? "success" : "error");
  box.innerHTML = message;
}

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
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
  navigator.clipboard.writeText(text).then(() => alert("✅ Copied to clipboard!"));
}

function shareLink(link) {
  if (navigator.share) {
    navigator.share({ title: "Check this out!", url: link });
  } else {
    alert("❌ Browser doesn't support share.");
  }
}

function shorten() {
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
        if (error) {
          return updateResultBox("❌ Failed to shorten", false);
        } else {
          const shortUrl = `${location.origin}/file/?alias=${alias}`;
          updateResultBox(`
            <div class="og-card">
              <img src="https://api.apiflash.com/v1/urltoimage?access_key=b0e5bc53bdf0417eb10f041ec400ebaf&url=${encodeURIComponent(shortUrl)}" />
              <div class="og-info">
                <h3>✅ Short Link Created</h3>
                <p>${shortUrl}</p>
                <div class="share-buttons">
                  <a href="https://wa.me/?text=${encodeURIComponent(shortUrl)}" target="_blank">WhatsApp</a>
                  <a href="https://t.me/share/url?url=${encodeURIComponent(shortUrl)}" target="_blank">Telegram</a>
                  <a onclick="shareLink('${shortUrl}')" style="cursor:pointer;">More</a>
                </div>
              </div>
            </div>
            <button class="button" onclick="copyToClipboard('${shortUrl}')">📋 Copy</button><br><br>
            <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(shortUrl)}&size=150x150" />
          `, true);
        }
      });
    }
  });
}
