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

// --- AUTH STATE LISTENER ---
auth.onAuthStateChanged(user => {
  currentUser = user;
  const body = document.body;
  const userDisplay = document.getElementById("userIdDisplay");
  const authButtons = document.querySelector('#authButtons');
  
  if (user) {
    // Logged In
    userDisplay.innerHTML = `👋 Hi, ${user.email.split('@')[0]}`;
    document.querySelector('button[onclick="toggleAuthModal()"]').style.display = "none";
    document.querySelector('button[onclick="signOut()"]').style.display = "inline-block";
    
    // Sidebar data
    document.getElementById("userEmail").textContent = user.email;
    fetchUserLinks(user.uid);
  } else {
    // Guest
    userDisplay.innerHTML = "";
    document.querySelector('button[onclick="toggleAuthModal()"]').style.display = "inline-block";
    document.querySelector('button[onclick="signOut()"]').style.display = "none";
    
    // Clear sidebar
    document.getElementById("userLinksList").innerHTML = "";
    document.getElementById("userEmail").textContent = "Please log in to see your links.";
  }
});

// --- AUTH ACTIONS ---
function toggleAuthModal() {
  const modal = document.getElementById("authModal");
  modal.style.display = modal.style.display === "flex" ? "none" : "flex";
}

function signUp() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("signupBtn");
  btn.innerText = "Creating...";
  
  auth.createUserWithEmailAndPassword(email, password)
    .then(() => { toggleAuthModal(); btn.innerText = "Create Account"; })
    .catch(err => { alert(err.message); btn.innerText = "Create Account"; });
}

function signIn() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("loginBtn");
  btn.innerText = "Logging in...";

  auth.signInWithEmailAndPassword(email, password)
    .then(() => { toggleAuthModal(); btn.innerText = "Log In"; })
    .catch(err => { alert(err.message); btn.innerText = "Log In"; });
}

function signOut() {
  auth.signOut().then(() => { location.reload(); });
}

function resetPassword() {
  const email = document.getElementById("email").value.trim();
  if (!email) return alert("Please enter your email address first.");
  auth.sendPasswordResetEmail(email)
    .then(() => alert("Reset link sent to your email."))
    .catch(err => alert(err.message));
}

// --- SHORTENER LOGIC ---
function showLoader(show) {
  document.getElementById("loader").style.display = show ? "flex" : "none";
}

function handleExpiryChange() {
  const val = document.getElementById("expiry").value;
  document.getElementById("customExpiry").style.display = val === "custom" ? "block" : "none";
}

function getExpiryTimestamp(option, customDate) {
  if (option === "custom" && customDate) return new Date(customDate).getTime();
  const now = Date.now();
  if (option === "1h") return now + 3600000;
  if (option === "1d") return now + 86400000;
  if (option === "7d") return now + 604800000;
  return null;
}

function shorten() {
  const longUrl = document.getElementById("longUrl").value.trim();
  let alias = document.getElementById("customAlias").value.trim();
  const password = document.getElementById("linkPassword").value.trim();
  const expiryOpt = document.getElementById("expiry").value;
  const customExp = document.getElementById("customExpiry").value;
  const resultBox = document.getElementById("result");

  // Reset UI
  resultBox.innerHTML = "";
  resultBox.className = "result-box";

  if (!longUrl) return alert("Please enter a URL.");
  let formattedUrl = longUrl.startsWith("http") ? longUrl : "https://" + longUrl;

  // Auto-generate alias if empty
  if (!alias) {
    alias = Math.random().toString(36).substring(2, 8);
  }

  showLoader(true);
  const ref = db.ref("links/" + alias);

  ref.once("value").then(snapshot => {
    if (snapshot.exists()) {
      showLoader(false);
      resultBox.className = "result-box error";
      resultBox.innerHTML = "❌ Alias is already taken. Try another one.";
      return;
    }

    const payload = {
      url: formattedUrl,
      password: password || null,
      createdAt: Date.now(),
      expiresAt: getExpiryTimestamp(expiryOpt, customExp),
      userId: currentUser ? currentUser.uid : "guest",
      userEmail: currentUser ? currentUser.email : null
    };

    ref.set(payload, err => {
      showLoader(false);
      if (err) {
        resultBox.className = "result-box error";
        resultBox.innerHTML = "❌ Database error: " + err.message;
      } else {
        const shortUrl = `${location.origin}/${alias}`;
        
        // --- THIS IS THE FIXED PRO UI GENERATION ---
        resultBox.className = "result-box"; // Remove error class
        resultBox.innerHTML = `
          <div class="og-card">
            <img src="https://api.apiflash.com/v1/urltoimage?access_key=b0e5bc53bdf0417eb10f041ec400ebaf&url=${encodeURIComponent(shortUrl)}" 
                 class="preview-img" 
                 onerror="this.style.display='none'" />
            
            <div class="og-info">
              <h3>🎉 Short Link Ready!</h3>
              
              <div class="link-display">
                <input type="text" value="${shortUrl}" readonly id="shortUrlInput" onclick="this.select()">
                <button class="copy-btn" onclick="copyToClipboard('${shortUrl}')">Copy</button>
              </div>

              <div class="share-buttons">
                <a href="https://wa.me/?text=${encodeURIComponent(shortUrl)}" target="_blank" class="share-btn">
                  💬 WhatsApp
                </a>
                <a href="https://t.me/share/url?url=${encodeURIComponent(shortUrl)}" target="_blank" class="share-btn">
                  ✈️ Telegram
                </a>
                <a onclick="shareNative('${shortUrl}')" class="share-btn" style="cursor: pointer;">
                  🔗 Share
                </a>
              </div>
            </div>
          </div>

          <div class="qr-container">
            <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(shortUrl)}&size=120x120" alt="QR Code" />
          </div>
        `;
      }
    });
  });
}

// --- UTILS ---
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.copy-btn');
    const originalText = btn.innerText;
    btn.innerText = "Copied!";
    btn.style.background = "#22c55e";
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.background = ""; // reset to CSS default
    }, 2000);
  });
}

function shareNative(url) {
  if (navigator.share) {
    navigator.share({ title: "Short Link", url: url });
  } else {
    copyToClipboard(url);
    alert("Link copied to clipboard!");
  }
}

// --- SIDEBAR LOGIC (PRO ALIGNMENT) ---
let linksListener = null;

function fetchUserLinks(uid) {
  const userLinksRef = db.ref("links");
  const linksList = document.getElementById("userLinksList");
  
  if (linksListener) userLinksRef.off("value", linksListener);
  
  linksListener = userLinksRef.orderByChild("userId").equalTo(uid);
  
  linksListener.on("value", snapshot => {
    linksList.innerHTML = "";
    if (!snapshot.exists()) {
      linksList.innerHTML = "<div style='color: #94a3b8; text-align:center; padding:20px;'>No links found.</div>";
      return;
    }
    
    snapshot.forEach(child => {
      const alias = child.key;
      const data = child.val();
      
      const item = document.createElement("div");
      item.className = "link-item";
      
      item.innerHTML = `
        <a href="/${alias}" target="_blank" class="link-alias">/${alias}</a>
        <div class="link-meta">
          <span>${data.password ? '🔒 Protected' : '🌐 Public'}</span>
          <div>
            <button onclick="showEditForm('${alias}')" class="action-btn">✏️</button>
            <button onclick="deleteUserLink('${alias}')" class="action-btn">🗑️</button>
          </div>
        </div>
        
        <div id="edit-${alias}" style="display:none; margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
          <input type="text" id="new-alias-${alias}" value="${alias}" class="input" style="padding:8px; font-size:0.9rem; margin-bottom:5px;">
          <input type="password" id="new-pass-${alias}" placeholder="New Password" class="input" style="padding:8px; font-size:0.9rem; margin-bottom:5px;">
          <div style="display:flex; gap:5px;">
            <button onclick="updateUserLink('${alias}')" class="button" style="padding:8px; font-size:0.8rem;">Save</button>
            <button onclick="document.getElementById('edit-${alias}').style.display='none'" class="button" style="padding:8px; font-size:0.8rem; background:#ef4444;">Cancel</button>
          </div>
        </div>
      `;
      linksList.prepend(item); // Newest first
    });
  });
}

function showEditForm(alias) {
  const form = document.getElementById(`edit-${alias}`);
  form.style.display = form.style.display === "none" ? "block" : "none";
}

function deleteUserLink(alias) {
  if (confirm("Are you sure you want to delete this link?")) {
    db.ref(`links/${alias}`).remove();
  }
}

function updateUserLink(oldAlias) {
  const newAlias = document.getElementById(`new-alias-${oldAlias}`).value.trim();
  const newPassword = document.getElementById(`new-pass-${oldAlias}`).value.trim();
  
  if (!newAlias) return alert("Alias cannot be empty");
  
  const oldRef = db.ref(`links/${oldAlias}`);
  const newRef = db.ref(`links/${newAlias}`);
  
  oldRef.once("value", snap => {
    const data = snap.val();
    data.password = newPassword || null;
    
    if (oldAlias === newAlias) {
      oldRef.set(data).then(() => {
        alert("Updated!");
        document.getElementById(`edit-${oldAlias}`).style.display='none';
      });
    } else {
      newRef.once("value", existsSnap => {
        if (existsSnap.exists()) return alert("Alias taken!");
        newRef.set(data).then(() => {
          oldRef.remove();
          alert("Alias updated!");
        });
      });
    }
  });
}

// Paste this at the bottom of script.js
function showToast(message) {
    // Create element if not exists
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.className = "toast show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}