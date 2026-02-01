let db;
let auth;
let currentUser = null;

async function initApp() {
  try {
    const response = await fetch('/api/get_config');
    const config = await response.json();

    firebase.initializeApp(config.firebase);
    db = firebase.database();
    auth = firebase.auth();

    // Global Auth Listener
    auth.onAuthStateChanged(user => {
      currentUser = user;
      updateUI(user);
      
      // If we are on the dashboard page, load the grid
      if (document.getElementById('myLinksGrid')) {
          if (user) {
              loadUserDashboard(user.uid);
          } else {
              // Redirect guest to home
              window.location.href = "/";
          }
      }
    });

  } catch (error) {
    console.error("Config Error:", error);
    showToast("System Error: Could not load configuration.", "error");
  }
}
initApp();

function updateUI(user) {
  // Update Header Elements
  const userDisplay = document.getElementById("userIdDisplay");
  if(userDisplay) userDisplay.innerHTML = user ? `👋 ${user.email.split('@')[0]}` : "";
  
  // Elements on Index.html
  const loginBtnTop = document.getElementById("loginBtnTop");
  const signoutBtnTop = document.getElementById("signoutBtnTop");
  const myLinksBtn = document.getElementById("myLinksBtn");
  
  if (loginBtnTop) loginBtnTop.style.display = user ? "none" : "inline-block";
  if (signoutBtnTop) signoutBtnTop.style.display = user ? "inline-block" : "none";
  if (myLinksBtn) myLinksBtn.style.display = user ? "inline-block" : "none";

  // Elements in Sidebar
  const mobLogin = document.getElementById("mobileLoginBtn");
  const mobSignout = document.getElementById("mobileSignoutBtn");
  const mobDisplay = document.getElementById("mobileUserDisplay");
  
  if(mobLogin) mobLogin.style.display = user ? "none" : "block";
  if(mobSignout) mobSignout.style.display = user ? "block" : "none";
  if(mobDisplay) mobDisplay.innerText = user ? user.email : "";

  // Elements on Dashboard
  const dashEmail = document.getElementById("userEmailDisplay");
  if(dashEmail && user) dashEmail.innerText = user.email;
}

// --- DASHBOARD LOGIC (MY LINKS PAGE) ---
function loadUserDashboard(uid) {
  const grid = document.getElementById("myLinksGrid");
  const loader = document.getElementById("dashboardLoader");
  if(!grid) return;

  grid.innerHTML = ""; 
  
  db.ref("links").orderByChild("userId").equalTo(uid).once("value").then(snapshot => {
    if(loader) loader.style.display = "none";
    
    if (!snapshot.exists()) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--text-muted);">
        <h3>No links found 🤷‍♂️</h3>
        <p>Go back to home to create your first short link!</p>
      </div>`;
      return;
    }

    snapshot.forEach(child => {
      const alias = child.key;
      const data = child.val();
      
      // Fetch click count for this link
      db.ref("clicks/" + alias).once("value").then(clickSnap => {
          const clickCount = clickSnap.exists() ? clickSnap.numChildren() : 0;
          renderLinkCard(alias, data, clickCount, grid);
      });
    });
  });
}

function renderLinkCard(alias, data, clicks, container) {
  const card = document.createElement("div");
  card.className = "link-card";
  
  const isLocked = !!data.password;
  const isExpired = data.expiresAt && data.expiresAt < Date.now();
  
  // Format Date
  const expiryDate = data.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : "Never";

  card.innerHTML = `
    <div class="card-header">
      <span class="alias-badge">/${alias}</span>
      <span class="click-badge">📊 ${clicks} clicks</span>
    </div>
    
    <div class="long-url" title="${data.url}">${data.url}</div>
    
    <div class="meta-tags">
        ${isLocked ? '<span class="tag locked">🔒 Password</span>' : ''}
        ${isExpired ? '<span class="tag expired">⚠️ Expired</span>' : '<span class="tag">Active</span>'}
        <span class="tag">📅 Exp: ${expiryDate}</span>
    </div>

    <div class="card-actions">
        <button onclick="openEditModal('${alias}')" class="button" style="padding: 8px; font-size: 0.9rem;">✏️ Edit</button>
        <button onclick="deleteUserLink('${alias}')" class="button" style="padding: 8px; font-size: 0.9rem; background: rgba(239, 68, 68, 0.2); color: #fca5a5;">🗑️ Delete</button>
    </div>
    
    <div style="margin-top:10px; display:flex; gap:10px;">
       <button onclick="copyToClipboard('${location.origin}/${alias}')" class="button" style="background:transparent; border:1px solid var(--border-color); color:var(--text-muted); padding:5px;">📋 Copy Link</button>
       <a href="/${alias}" target="_blank" class="button" style="background:transparent; border:1px solid var(--border-color); color:var(--text-muted); padding:5px; text-decoration:none; text-align:center;">↗️ Visit</a>
    </div>
  `;
  
  // Prepend to show newest first if we were sorting, but simple append works
  container.prepend(card); 
}

// --- EDIT MODAL LOGIC ---
function openEditModal(alias) {
  const modal = document.getElementById("editModal");
  document.getElementById("editOriginalAlias").value = alias;
  document.getElementById("editAlias").value = alias;
  
  // Fetch latest data to fill form
  db.ref("links/" + alias).once("value").then(snap => {
     const data = snap.val();
     document.getElementById("editUrl").value = data.url;
     document.getElementById("editPassword").value = data.password || "";
     
     // Handle Date for Input (YYYY-MM-DDTHH:MM)
     if(data.expiresAt) {
         const date = new Date(data.expiresAt);
         const str = date.toISOString().slice(0, 16); // format for input type=datetime-local
         document.getElementById("editExpiry").value = str;
     } else {
         document.getElementById("editExpiry").value = "";
     }
     
     modal.style.display = "flex";
  });
}

function closeEditModal() {
  document.getElementById("editModal").style.display = "none";
}

function clearExpiry() {
    document.getElementById("editExpiry").value = "";
}

async function saveLinkChanges() {
    const oldAlias = document.getElementById("editOriginalAlias").value;
    const newAlias = document.getElementById("editAlias").value.trim();
    const newPassword = document.getElementById("editPassword").value.trim();
    const expiryInput = document.getElementById("editExpiry").value;
    
    if(!newAlias) return showToast("Alias cannot be empty", "error");

    const newExpiry = expiryInput ? new Date(expiryInput).getTime() : null;
    
    const oldRef = db.ref("links/" + oldAlias);
    const newRef = db.ref("links/" + newAlias);
    
    try {
        const snap = await oldRef.once("value");
        const data = snap.val();
        
        // Update Data Object
        data.password = newPassword || null; // Remove if empty
        data.expiresAt = newExpiry; 
        
        if (oldAlias === newAlias) {
            // Simple Update
            await oldRef.update(data);
            showToast("Link updated successfully!", "success");
        } else {
            // Alias Change: Check if new alias is taken
            const exists = await newRef.once("value");
            if(exists.exists()) return showToast("Alias already taken!", "error");
            
            // Move Data
            await newRef.set(data);
            await oldRef.remove();
            
            // Move Clicks Data too
            const clicksSnap = await db.ref("clicks/" + oldAlias).once("value");
            if(clicksSnap.exists()) {
                await db.ref("clicks/" + newAlias).set(clicksSnap.val());
                await db.ref("clicks/" + oldAlias).remove();
            }
            
            showToast("Link moved to new alias!", "success");
        }
        
        closeEditModal();
        loadUserDashboard(currentUser.uid); // Refresh Grid
        
    } catch (e) {
        console.error(e);
        showToast("Error updating link: " + e.message, "error");
    }
}

function deleteUserLink(alias) {
  if (confirm("Permanently delete this link? Stats will be lost.")) {
    db.ref(`links/${alias}`).remove()
      .then(() => {
          db.ref(`clicks/${alias}`).remove(); // Cleanup stats
          showToast("Link deleted", "success");
          loadUserDashboard(currentUser.uid);
      })
      .catch(err => showToast(err.message, "error"));
  }
}


// --- GENERAL UTILS ---
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
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.neutral}</span><span class="toast-msg">${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard!", "success"));
}

function showLoader(show) {
  const loader = document.getElementById("loader");
  if(loader) loader.style.display = show ? "flex" : "none";
}




// --- AUTH ACTIONS ---
function toggleAuthModal() {
  const modal = document.getElementById("authModal");
  modal.style.display = modal.style.display === "flex" ? "none" : "flex";
  document.getElementById("recaptcha-wrapper").style.display = "none";
  const resetBtn = document.getElementById("resetBtn");
  if(resetBtn) resetBtn.innerText = "Forgot Password?";
}

function signUp() {
  if (!auth) return;
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
  if (!auth) return;
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("loginBtn");

  if(!email || !password) return showToast("Please enter email and password", "error");

  btn.innerText = "Logging in...";
  
  auth.signInWithEmailAndPassword(email, password)
    .then((userCred) => {
      // BAN CHECK
      const userEmail = userCred.user.email;
      const encodedEmail = btoa(userEmail);
      
      db.ref("bannedEmails/" + encodedEmail).once("value").then(snap => {
        if (snap.exists()) {
          auth.signOut();
          showToast("Your mail was banned please contact us for apeal", "error");
          btn.innerText = "Log In";
        } else {
          toggleAuthModal(); 
          btn.innerText = "Log In"; 
          showToast("Welcome back!", "success");
        }
      });
    })
    .catch(err => { 
      showToast(cleanError(err.message), "error"); 
      btn.innerText = "Log In"; 
    });
}

function signOut() {
  if (!auth) return;
  auth.signOut().then(() => { 
    showToast("Signed out successfully", "neutral");
    setTimeout(() => location.reload(), 1000);
  });
}

function resetPassword() {
  if (!auth) return;
  const emailField = document.getElementById("email");
  const email = emailField.value.trim();
  const btn = document.getElementById("resetBtn");
  const captchaWrapper = document.getElementById("recaptcha-wrapper");
  
  if (!email) {
    showToast("Please type your email in the box above first!", "error");
    emailField.focus();
    emailField.style.borderColor = "#ef4444"; 
    setTimeout(() => emailField.style.borderColor = "", 2000);
    return;
  }

  if (captchaWrapper.style.display === "none") {
    captchaWrapper.style.display = "block";
    btn.innerText = "Verify & Send Link";
    showToast("Please complete the captcha below.", "neutral");
    return;
  }

  const response = grecaptcha.getResponse();
  if (response.length === 0) {
    showToast("Please complete the captcha checkbox!", "error");
    return;
  }

  btn.innerText = "Sending...";
  btn.disabled = true;

  auth.sendPasswordResetEmail(email)
    .then(() => {
      showToast("Reset link sent! Check your inbox.", "success");
      btn.innerText = "Email Sent ✅";
      captchaWrapper.style.display = "none";
      grecaptcha.reset();
    })
    .catch(err => {
      showToast(cleanError(err.message), "error");
      btn.innerText = "Forgot Password?";
      btn.disabled = false;
      grecaptcha.reset();
    });
}

function cleanError(msg) {
  return msg.replace("Firebase: ", "").replace(/\(auth\/.*\)\.?/, "").trim();
}

// --- SHORTENER LOGIC ---
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

async function shorten() {
  if (!db) return showToast("System initializing...", "neutral");
  const longUrl = document.getElementById("longUrl").value.trim();
  let alias = document.getElementById("customAlias").value.trim();
  const password = document.getElementById("linkPassword").value.trim();
  const expiryOpt = document.getElementById("expiry").value;
  const customExp = document.getElementById("customExpiry").value;
  const resultBox = document.getElementById("result");

  resultBox.innerHTML = "";
  
  if (!longUrl) return showToast("Please paste a URL to shorten", "error");
  
  if (!currentUser) {
    try {
      showLoader(true);
      const ipRes = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipRes.json();
      const userIp = ipData.ip;
      
      const bannedSnap = await db.ref("bannedIps/" + btoa(userIp)).get();
      
      if (bannedSnap.exists()) {
        showLoader(false);
        showToast("Your IP was banned please contact us for apeal", "error");
        return;
      }
    } catch (e) {
      console.warn("IP Check failed, allowing:", e);
    }
  }

  let formattedUrl = longUrl.startsWith("http") ? longUrl : "https://" + longUrl;
  if (!alias) alias = Math.random().toString(36).substring(2, 8);

  showLoader(true);
  const ref = db.ref("links/" + alias);

  ref.once("value").then(snapshot => {
    if (snapshot.exists()) {
      showLoader(false);
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
      showLoader(false);
      if (err) {
        showToast("Database error: " + err.message, "error");
      } else {
        showToast("Link created successfully!", "success");
        const shortUrl = `${location.origin}/${alias}`;
        
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

// --- SIDEBAR LOGIC ---
let linksListener = null;

function fetchUserLinks(uid) {
  if (!db) return;
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