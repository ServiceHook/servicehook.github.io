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

// --- TOAST SYSTEM (Replaces Alerts) ---
function showToast(message, type = 'neutral') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', neutral: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.neutral}</span>
    <span class="toast-msg">${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// --- AUTH STATE LISTENER ---
auth.onAuthStateChanged(user => {
  currentUser = user;
  const userDisplay = document.getElementById("userIdDisplay");
  
  if (user) {
    if(userDisplay) userDisplay.innerHTML = `👋 Hi, ${user.email.split('@')[0]}`;
    const loginBtn = document.querySelector('button[onclick="toggleAuthModal()"]');
    const signoutBtn = document.querySelector('button[onclick="signOut()"]');
    
    if(loginBtn) loginBtn.style.display = "none";
    if(signoutBtn) signoutBtn.style.display = "inline-block";
    
    const emailEl = document.getElementById("userEmail");
    if(emailEl) emailEl.textContent = user.email;
    fetchUserLinks(user.uid);
  } else {
    if(userDisplay) userDisplay.innerHTML = "";
    const loginBtn = document.querySelector('button[onclick="toggleAuthModal()"]');
    const signoutBtn = document.querySelector('button[onclick="signOut()"]');

    if(loginBtn) loginBtn.style.display = "inline-block";
    if(signoutBtn) signoutBtn.style.display = "none";
    
    const linksList = document.getElementById("userLinksList");
    if(linksList) linksList.innerHTML = "";
    const emailEl = document.getElementById("userEmail");
    if(emailEl) emailEl.textContent = "Please log in to see your links.";
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
  
  if(!email || !password) return showToast("Please enter email and password", "error");

  btn.innerText = "Creating...";
  auth.createUserWithEmailAndPassword(email, password)
    .then(() => { 
      toggleAuthModal(); 
      btn.innerText = "Create Account"; 
      showToast("Account created successfully!", "success");
    })
    .catch(err => { 
      showToast(cleanError(err.message), "error"); 
      btn.innerText = "Create Account"; 
    });
}

function signIn() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("loginBtn");

  if(!email || !password) return showToast("Please enter email and password", "error");

  btn.innerText = "Logging in...";
  auth.signInWithEmailAndPassword(email, password)
    .then(() => { 
      toggleAuthModal(); 
      btn.innerText = "Log In"; 
      showToast("Welcome back!", "success");
    })
    .catch(err => { 
      showToast(cleanError(err.message), "error"); 
      btn.innerText = "Log In"; 
    });
}

function signOut() {
  auth.signOut().then(() => { 
    showToast("Signed out successfully", "neutral");
    setTimeout(() => location.reload(), 1000);
  });
}

// --- FIXED FORGOT PASSWORD LOGIC ---
function resetPassword() {
  const emailField = document.getElementById("email");
  const email = emailField.value.trim();
  const btn = document.getElementById("resetBtn");
  
  // If email is empty, visually guide user to the email box
  if (!email) {
    showToast("Please type your email in the box above first!", "error");
    emailField.focus();
    emailField.style.borderColor = "#ef4444"; 
    setTimeout(() => emailField.style.borderColor = "", 2000);
    return;
  }

  btn.innerText = "Sending...";
  btn.disabled = true;

  auth.sendPasswordResetEmail(email)
    .then(() => {
      showToast("Reset link sent! Check your inbox.", "success");
      btn.innerText = "Email Sent ✅";
    })
    .catch(err => {
      showToast(cleanError(err.message), "error");
      btn.innerText = "Forgot Password?";
      btn.disabled = false;
    });
}

function cleanError(msg) {
  return msg.replace("Firebase: ", "").replace(/\(auth\/.*\)\.?/, "").trim();
}

// --- SHORTENER LOGIC ---
// ... [Keep Firebase Config & Auth Logic exactly as before] ...

// --- SHORTENER LOGIC (FIXED) ---
function showLoader(show) {
  const loader = document.getElementById("loader");
  if(loader) loader.style.display = show ? "flex" : "none";
}

function handleExpiryChange() {
  const val = document.getElementById("expiry").value;
  const customInput = document.getElementById("customExpiry");
  if(customInput) customInput.style.display = val === "custom" ? "block" : "none";
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
  
  if (!longUrl) return showToast("Please paste a URL to shorten", "error");
  
  let formattedUrl = longUrl.startsWith("http") ? longUrl : "https://" + longUrl;

  if (!alias) alias = Math.random().toString(36).substring(2, 8);

  showLoader(true); // START LOADING
  
  const ref = db.ref("links/" + alias);

  ref.once("value").then(snapshot => {
    if (snapshot.exists()) {
      showLoader(false); // STOP LOADING
      showToast("That alias is already taken", "error");
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
      showLoader(false); // STOP LOADING
      
      if (err) {
        showToast("Database error: " + err.message, "error");
      } else {
        showToast("Link created successfully!", "success");
        const shortUrl = `${location.origin}/${alias}`;
        
        // FORCE UI UPDATE
        resultBox.style.display = "block";
        resultBox.innerHTML = `
          <div class="og-card" style="animation: slideUp 0.5s ease-out;">
            <img src="https://api.apiflash.com/v1/urltoimage?access_key=b0e5bc53bdf0417eb10f041ec400ebaf&url=${encodeURIComponent(shortUrl)}" 
                 class="preview-img" onerror="this.style.display='none'" />
            <div class="og-info">
              <h3>🎉 Short Link Ready!</h3>
              <div class="link-display">
                <input type="text" value="${shortUrl}" readonly onclick="this.select()">
                <button class="copy-btn" onclick="copyToClipboard('${shortUrl}')">Copy</button>
              </div>
              <div class="share-buttons">
                <a href="https://wa.me/?text=${encodeURIComponent(shortUrl)}" target="_blank" class="share-btn">💬 WhatsApp</a>
                <a href="https://t.me/share/url?url=${encodeURIComponent(shortUrl)}" target="_blank" class="share-btn">✈️ Telegram</a>
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

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("Copied to clipboard!", "success");
  });
}

// ... [Include the rest of the file: Auth Logic, Sidebar Logic, etc. from previous turn] ...

// --- SIDEBAR LOGIC ---
let linksListener = null;

function fetchUserLinks(uid) {
  const userLinksRef = db.ref("links");
  const linksList = document.getElementById("userLinksList");
  if (linksListener) userLinksRef.off("value", linksListener);
  linksListener = userLinksRef.orderByChild("userId").equalTo(uid);
  linksListener.on("value", snapshot => {
    if(!linksList) return;
    linksList.innerHTML = "";
    if (!snapshot.exists()) {
      linksList.innerHTML = "<div style='color: #94a3b8; text-align:center; padding:20px;'>No links found.</div>";
      return;
    }
    const items = [];
    snapshot.forEach(child => { items.push({ key: child.key, val: child.val() }); });
    items.reverse().forEach(({key: alias, val: data}) => {
      const item = document.createElement("div");
      item.className = "link-item";
      item.innerHTML = `
        <a href="/${alias}" target="_blank" class="link-alias">/${alias}</a>
        <div class="link-meta">
          <span>${data.password ? '🔒 Protected' : '🌐 Public'}</span>
          <div>
            <button onclick="showEditForm('${alias}')" class="action-btn">✏️</button>
            <button onclick="deleteUserLink('${alias}')" class="action-btn" style="background:rgba(239, 68, 68, 0.2);color:#fca5a5;">🗑️</button>
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
      linksList.appendChild(item);
    });
  });
}

function showEditForm(alias) {
  const form = document.getElementById(`edit-${alias}`);
  form.style.display = form.style.display === "none" ? "block" : "none";
}

function deleteUserLink(alias) {
  if (confirm("Permanently delete this link?")) {
    db.ref(`links/${alias}`).remove()
      .then(() => showToast("Link deleted", "success"))
      .catch(err => showToast(err.message, "error"));
  }
}

function updateUserLink(oldAlias) {
  const newAlias = document.getElementById(`new-alias-${oldAlias}`).value.trim();
  const newPassword = document.getElementById(`new-pass-${oldAlias}`).value.trim();
  if (!newAlias) return showToast("Alias cannot be empty", "error");
  const oldRef = db.ref(`links/${oldAlias}`);
  const newRef = db.ref(`links/${newAlias}`);
  oldRef.once("value", snap => {
    const data = snap.val();
    data.password = newPassword || null;
    if (oldAlias === newAlias) {
      oldRef.set(data).then(() => {
        showToast("Link updated!", "success");
        document.getElementById(`edit-${oldAlias}`).style.display='none';
      });
    } else {
      newRef.once("value", existsSnap => {
        if (existsSnap.exists()) return showToast("That alias is already taken", "error");
        newRef.set(data).then(() => {
          oldRef.remove();
          showToast("Alias updated!", "success");
        });
      });
    }
  });
}