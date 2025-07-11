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


function initiateSubscription() {
  if (!currentUser) {
    toggleAuthModal();
    return alert("🔐 Please log in to continue.");
  }

  const confirmBox = document.createElement("div");
  confirmBox.innerHTML = `
    <div style="background:#1e293b; color:white; padding:20px; border-radius:10px; width:300px; margin:auto;">
      <h3>🚫 Ad-Free Plan – ₹499</h3>
      <p>Send ₹499 to this UPI ID:</p>
      <strong style="font-size: 18px;">6282829338@superyes</strong>
      <p>Then enter your Transaction ID below 👇</p>
      <input type="text" id="txnIdInput" placeholder="Transaction ID" class="input" style="margin-bottom:10px;" />
      <button onclick="submitTxnId()">✅ Submit</button>
      <button onclick="this.parentElement.remove()">❌ Cancel</button>
    </div>
  `;
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:99999; display:flex; justify-content:center; align-items:center;";
  wrapper.appendChild(confirmBox);
  document.body.appendChild(wrapper);
}

function submitTxnId() {
  const txnId = document.getElementById("txnIdInput").value.trim();
  if (!txnId) return alert("❌ Please enter your transaction ID.");

  const user = firebase.auth().currentUser;
  if (!user) return alert("❌ You must be logged in.");

  firebase.database().ref("subscriptions/" + btoa(user.email)).set({
    uid: user.uid,
    email: user.email,
    txnId: txnId,
    purchasedAt: Date.now(),
    status: "pending" // You can change this to "active" after verification
  }).then(() => {
    alert("✅ Submitted! Your subscription will be activated soon.");
    
    // ✅ FIX: Check if modal exists before removing
    const modal = document.getElementById("txnModal");
    if (modal) modal.remove();
  });
}



auth.onAuthStateChanged(user => {
  currentUser = user;
  document.getElementById("userIdDisplay").textContent = user
    ? `👤 ${user.email || user.uid}`
    : "👤 Guest";

  document.querySelector('#authButtons button[onclick="toggleAuthModal()"]').style.display = user ? "none" : "inline-block";
  document.querySelector('#authButtons button[onclick="signOut()"]').style.display = user ? "inline-block" : "none";

  const sidebar = document.getElementById("sidebar");
  if (user) {
    document.getElementById("userEmail").textContent = user.email;
    sidebar.classList.remove("hidden");
    fetchUserLinks(user.uid);
	checkSubscription(user.uid); // 🔄 Add this
  } else {
    sidebar.classList.add("hidden");
  }
});

function checkSubscription(uid) {
  db.ref(`users/${uid}`).once("value").then(snapshot => {
    const data = snapshot.val();
    if (data?.isSubscribed) {
      hideAds();
    } else {
      showAds();
    }
  });
}

function hideAds() {
  const adScripts = document.querySelectorAll('script[data-zone="155869"]');
  adScripts.forEach(script => script.remove());
}

function showAds() {
  if (!document.querySelector('script[data-zone="155869"]')) {
    const adScript = document.createElement("script");
    adScript.src = "https://fpyf8.com/88/tag.min.js";
    adScript.async = true;
    adScript.setAttribute("data-zone", "155869");
    adScript.setAttribute("data-cfasync", "false");
    document.body.appendChild(adScript);
  }
}


firebase.auth().onAuthStateChanged(user => {
  if (user) {
    const uid = user.uid;
    // Check if user is subscribed
    firebase.database().ref("subscriptions").orderByChild("uid").equalTo(uid).once("value").then(snapshot => {
      const subs = snapshot.val();
      if (subs) {
        const subData = Object.values(subs)[0];
        if (subData.status === "approved") {
          console.log("✅ Ad-Free Subscriber - Removing Ads");
          const adContainer = document.getElementById("ads-container");
          if (adContainer) adContainer.remove();
        } else {
          console.log("ℹ️ Subscription not approved yet");
        }
      } else {
        console.log("🧑 Not a subscriber");
      }
    });
  }
});

const badge = document.createElement("span");
badge.innerText = "🌟 PRO USER (Ad-Free)";
badge.style.cssText = "background:#10b981; color:white; padding:4px 10px; border-radius:5px; margin-left:10px;";
document.getElementById("topUserInfo").appendChild(badge);



function toggleAuthModal() {
  const modal = document.getElementById("authModal");
  modal.style.display = modal.style.display === "flex" ? "none" : "flex";
}

function signUp() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const signupBtn = document.getElementById("signupBtn");

  signupBtn.classList.add("loading");

  auth.createUserWithEmailAndPassword(email, password)
    .then(() => {
      signupBtn.classList.remove("loading");
      toggleAuthModal();
    })
    .catch(err => {
      signupBtn.classList.remove("loading");
      alert("❌ " + err.message);
    });
}


function signIn() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const loginBtn = document.getElementById("loginBtn");

  loginBtn.classList.add("loading");

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      loginBtn.classList.remove("loading");
      toggleAuthModal();
    })
    .catch(err => {
      loginBtn.classList.remove("loading");
      alert("❌ " + err.message);
    });
}




function signOut() {
  auth.signOut()
    .then(() => {
      alert("👋 Signed out successfully.");
      location.reload(); // refresh the page
    })
    .catch(err => {
      alert("❌ Error signing out: " + err.message);
    });
}


function resetPassword() {
  const email = document.getElementById("email").value.trim();
  const resetBtn = document.getElementById("resetBtn");

  if (!email) return alert("❌ Please enter your email above.");

  auth.sendPasswordResetEmail(email)
    .then(() => {
      alert("📩 Password reset email sent! Check your inbox.");
      startResetCooldown(); // start the timer
    })
    .catch(err => alert("❌ " + err.message));
}

// Automatically enable/disable reset button based on input
document.getElementById("email").addEventListener("input", () => {
  const emailInput = document.getElementById("email").value.trim();
  const resetBtn = document.getElementById("resetBtn");

  // Only allow enabling if not in cooldown
  if (!resetBtn.dataset.cooldown && emailInput.length > 0) {
    resetBtn.disabled = false;
    resetBtn.style.opacity = "1";
    resetBtn.style.cursor = "pointer";
  } else if (emailInput.length === 0) {
    resetBtn.disabled = true;
    resetBtn.style.opacity = "0.5";
    resetBtn.style.cursor = "not-allowed";
  }
});

function startResetCooldown() {
  const resetBtn = document.getElementById("resetBtn");
  let cooldown = 60;

  resetBtn.disabled = true;
  resetBtn.dataset.cooldown = "true";
  resetBtn.style.opacity = "0.5";
  resetBtn.style.cursor = "not-allowed";

  const originalText = "🔄 Reset Password";

  const interval = setInterval(() => {
    resetBtn.textContent = `⏳ Retry in ${cooldown--}s...`;

    if (cooldown < 0) {
      clearInterval(interval);
      delete resetBtn.dataset.cooldown;

      const emailInput = document.getElementById("email").value.trim();
      if (emailInput.length > 0) {
        resetBtn.disabled = false;
        resetBtn.style.opacity = "1";
        resetBtn.style.cursor = "pointer";
      }
      resetBtn.textContent = originalText;
    }
  }, 1000);
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
      const userEmail = currentUser ? currentUser.email : null;

      ref.set({
        url: longUrl,
        password: password || null,
        createdAt: Date.now(),
        expiresAt: expiryTimestamp || null,
        userId,
        userEmail
      }, error => {
        showLoader(false);
        if (error) {
          return updateResultBox("❌ Failed to shorten", false);
        } else {
          const shortUrl = `${location.origin}/${alias}`;

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


let linksListener = null;

function fetchUserLinks(uid) {
  const userLinksRef = db.ref("links");
  const linksList = document.getElementById("userLinksList");

  // Remove previous listener if any
  if (linksListener) {
    userLinksRef.off("value", linksListener);
  }

  // Attach new real-time listener
  linksListener = userLinksRef.orderByChild("userId").equalTo(uid);
  linksListener.on("value", snapshot => {
    linksList.innerHTML = "";

    if (!snapshot.exists()) {
      linksList.innerHTML = "<li>No links found.</li>";
      return;
    }

    snapshot.forEach(child => {
      const alias = child.key;
      const data = child.val();

      const li = document.createElement("li");
      li.innerHTML = `
        <div>
          <strong>🔗 <a href="/file/?alias=${alias}" target="_blank">${alias}</a></strong><br/>
          ${data.password ? `🔒 Password: ${data.password}` : `🔓 No password`}
        </div>
        <div style="display:flex; gap:5px; margin-top:5px;">
          <button onclick="showEditForm('${alias}', '${data.password || ""}')">✏️ Edit</button>
          <button onclick="deleteUserLink('${alias}')">🗑️</button>
        </div>
        <div id="edit-${alias}" class="edit-form hidden">
          <input type="text" placeholder="New alias" id="new-alias-${alias}" class="input" value="${alias}" />
          <input type="password" placeholder="New password" id="new-pass-${alias}" class="input" />
          <button onclick="updateUserLink('${alias}')">✅ Save</button>
          <button onclick="cancelEdit('${alias}')">❌ Cancel</button>
        </div>
      `;
      linksList.appendChild(li);
    });
  });
}


function deleteUserLink(alias) {
  if (!confirm(`Delete the short link "${alias}"?`)) return;
  db.ref(`links/${alias}`).remove()
    .then(() => {
      alert("✅ Link deleted.");
      if (currentUser) fetchUserLinks(currentUser.uid);
    })
    .catch(err => alert("❌ Error deleting: " + err.message));
}


function showEditForm(alias, password) {
  document.getElementById(`edit-${alias}`).classList.remove("hidden");
}

function cancelEdit(alias) {
  document.getElementById(`edit-${alias}`).classList.add("hidden");
}

function updateUserLink(oldAlias) {
  const newAlias = document.getElementById(`new-alias-${oldAlias}`).value.trim();
  const newPassword = document.getElementById(`new-pass-${oldAlias}`).value.trim();

  if (!newAlias.match(/^[a-zA-Z0-9_-]+$/)) {
    return alert("❌ Alias must be alphanumeric with - or _");
  }

  const oldRef = db.ref("links/" + oldAlias);
  const newRef = db.ref("links/" + newAlias);

  oldRef.once("value", snapshot => {
    if (!snapshot.exists()) {
      return alert("❌ Original link not found");
    }

    const data = snapshot.val();
    data.password = newPassword || null;

    if (oldAlias === newAlias) {
      // Only password change
      oldRef.set(data).then(() => {
        alert("✅ Password updated");
        fetchUserLinks(currentUser.uid);
      });
    } else {
      // Changing alias
      newRef.once("value", snap => {
        if (snap.exists()) {
          return alert("❌ New alias is already taken");
        }

        newRef.set(data).then(() => {
          oldRef.remove().then(() => {
            alert("✅ Alias and password updated");
            fetchUserLinks(currentUser.uid);
          });
        });
      });
    }
  });
}

function toggleMode() {
  const body = document.body;
  const isLight = body.classList.toggle("light-mode");
  localStorage.setItem("theme", isLight ? "light" : "dark");

  const toggleBtn = document.getElementById("toggleModeBtn");
  toggleBtn.classList.add("toggle-anim");
  toggleBtn.textContent = isLight ? "🌙 Dark Mode" : "☀️ Light Mode";

  setTimeout(() => toggleBtn.classList.remove("toggle-anim"), 600);
}

// On Load, Apply Saved Theme with Animation
window.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme");
  const toggleBtn = document.getElementById("toggleModeBtn");

  if (savedTheme === "light") {
    document.body.classList.add("light-mode");
    toggleBtn.textContent = "🌙 Dark Mode";
  } else {
    toggleBtn.textContent = "☀️ Light Mode";
  }
});


function applyMobileThemeIfNeeded() {
  if (window.innerWidth <= 768) {
    document.body.classList.add("mobile-theme");
  }
}

window.addEventListener("DOMContentLoaded", applyMobileThemeIfNeeded);



