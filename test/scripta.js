const firebaseConfig = {
  apiKey: "AIzaSyBKA3bxy1caa0QiGrn6AihtxufiO7xxTnI",
  authDomain: "futrshortener-7acf0.firebaseapp.com",
  databaseURL: "https://futrshortener-7acf0-default-rtdb.firebaseio.com",
  projectId: "futrshortener-7acf0",
  storageBucket: "futrshortener-7acf0.appspot.com",
  messagingSenderId: "863839648409",
  appId: "1:863839648409:web:d20ae154fe1c9dc1b19608"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Auth
function login() {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const btn = document.querySelector("button[onclick='login()']");
  btn.innerText = "🔐 Logging in...";
  btn.disabled = true;

  firebase.auth().signInWithEmailAndPassword(email, password)
    .then(userCred => {
      const user = userCred.user;
      if (user.email !== "ztenkammu@gmail.com") {
        document.getElementById("loginError").innerText = "❌ Access Denied";
        firebase.auth().signOut();
      } else {
        document.getElementById("loginSection").style.display = "none";
        document.getElementById("adminContent").style.display = "flex";
        switchSection('dashboard');
        loadDashboard();
      }
    })
    .catch(err => {
      document.getElementById("loginError").innerText = "❌ " + err.message;
    })
    .finally(() => {
      btn.innerText = "Login";
      btn.disabled = false;
    });
}

firebase.auth().onAuthStateChanged(user => {
  if (user && user.email === "ztenkammu@gmail.com") {
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("adminContent").style.display = "flex";
    switchSection('dashboard');
    loadDashboard();
  } else {
    document.getElementById("loginSection").style.display = "block";
    document.getElementById("adminContent").style.display = "none";
  }
});

function logout() {
  firebase.auth().signOut().then(() => {
    alert("✅ Logged out");
    location.reload();
  });
}

function switchSection(id) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

// Dashboard
function loadDashboard() {
  db.ref("links").once("value").then(snap => {
    const data = snap.val() || {};
    const today = new Date().toDateString();
    let todayCount = 0;
    const last = Object.entries(data).slice(-5).reverse();
    const list = document.getElementById("lastLinks");
    list.innerHTML = "";

    Object.values(data).forEach(link => {
      if (new Date(link.createdAt).toDateString() === today) {
        todayCount++;
      }
    });

    document.getElementById("todayCount").innerText = todayCount;
    document.getElementById("totalCount").innerText = Object.keys(data).length;

    last.forEach(([alias, info]) => {
      const li = document.createElement("li");
      li.innerHTML = `<a href="/file/?alias=${alias}" target="_blank">${alias}</a> - ${info.url}`;
      list.appendChild(li);
    });
  });
}

// Manage URLs
let allLinks = [];
let currentIndex = 0;
const pageSize = 5;

function loadLinks() {
  db.ref("links").once("value").then(snapshot => {
    allLinks = Object.entries(snapshot.val() || {});
    currentIndex = 0;
    renderBatch();
  });
}

function renderBatch() {
  const tbody = document.querySelector("#urlTable tbody");
  tbody.innerHTML = "";
  const batch = allLinks.slice(currentIndex, currentIndex + pageSize);

  batch.forEach(([alias, info]) => {
    db.ref("clicks/" + alias).once("value").then(clickSnap => {
      const tr = document.createElement("tr");
      const clicks = clickSnap.exists() ? Object.keys(clickSnap.val()).length : 0;
      tr.innerHTML = `
        <td>${alias}</td>
        <td><a href="${info.url}" target="_blank">${info.url}</a></td>
        <td>${clicks}</td>
        <td>
          <button onclick="deleteLink('${alias}')" class="button">🗑️</button>
          <button onclick="showDetails('${alias}', this)" class="button">📈</button>
          <button onclick="banUser('${info.userEmail || ''}')" class="button">🚫</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });

  document.getElementById("pageInfo").innerText = `Page ${Math.floor(currentIndex / pageSize) + 1}`;
}

function showNextBatch() {
  if (currentIndex + pageSize < allLinks.length) {
    currentIndex += pageSize;
    renderBatch();
  }
}

function showPrevBatch() {
  if (currentIndex >= pageSize) {
    currentIndex -= pageSize;
    renderBatch();
  }
}

function deleteLink(alias) {
  if (confirm("Delete " + alias + "?")) {
    db.ref("links/" + alias).remove();
    db.ref("clicks/" + alias).remove();
    loadLinks();
  }
}

function showDetails(alias, btn) {
  const row = btn.closest("tr");
  let nextRow = row.nextElementSibling;

  if (nextRow && nextRow.classList.contains("details-row")) {
    nextRow.remove();
    return;
  }

  db.ref("clicks/" + alias).once("value").then(snap => {
    const clicks = snap.val();
    const detailRow = document.createElement("tr");
    detailRow.className = "details-row";

    const td = document.createElement("td");
    td.colSpan = 4;

    if (!clicks) {
      td.innerHTML = "<em>No click data available.</em>";
    } else {
      td.innerHTML = Object.values(clicks).map(c => `
        <div style="margin:6px 0; padding:10px; background:#f1f5f9; border-left:4px solid #3b82f6;">
          <b>📅 Time:</b> ${new Date(c.timestamp).toLocaleString()}<br>
          <b>🌍 Country:</b> ${c.country || 'N/A'}<br>
          <b>📍 Region:</b> ${c.region || 'N/A'}<br>
          <b>🏙️ City:</b> ${c.city || 'N/A'}<br>
          <b>📱 Device:</b> ${c.device || 'N/A'}<br>
          <b>🔐 IP:</b> ${c.ip || 'N/A'}
        </div>
      `).join('');
    }

    detailRow.appendChild(td);
    row.parentNode.insertBefore(detailRow, row.nextSibling);
  });
}

// Ban system
function banUser(email) {
  if (!email) return alert("❌ No email associated.");
  db.ref("bannedEmails/" + btoa(email)).set(true);
  loadBannedUsers();
}

function unbanUser(encodedEmail) {
  db.ref("bannedEmails/" + encodedEmail).remove();
  loadBannedUsers();
}

function loadBannedUsers() {
  db.ref("bannedEmails").once("value").then(snap => {
    const list = document.getElementById("bannedList");
    list.innerHTML = "";
    Object.keys(snap.val() || {}).forEach(encodedEmail => {
      const email = atob(encodedEmail);
      const li = document.createElement("li");
      li.innerHTML = `${email} <button onclick="unbanUser('${encodedEmail}')" class="button">Unban</button>`;
      list.appendChild(li);
    });
  });
}

window.onload = () => loadBannedUsers();

function searchLinks() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const tbody = document.querySelector("#urlTable tbody");
  tbody.innerHTML = "";

  const filtered = allLinks.filter(([alias, info]) =>
    alias.toLowerCase().includes(query) ||
    info.url.toLowerCase().includes(query)
  );

  filtered.slice(0, pageSize).forEach(([alias, info]) => {
    db.ref("clicks/" + alias).once("value").then(clickSnap => {
      const tr = document.createElement("tr");
      const clicks = clickSnap.exists() ? Object.keys(clickSnap.val()).length : 0;
      tr.innerHTML = `
        <td>${alias}</td>
        <td><a href="${info.url}" target="_blank">${info.url}</a></td>
        <td>${clicks}</td>
        <td>
          <button onclick="deleteLink('${alias}')" class="button">🗑️</button>
          <button onclick="showDetails('${alias}', this)" class="button">📈</button>
          <button onclick="banUser('${info.userEmail || ''}')" class="button">🚫</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });

  document.getElementById("pageInfo").innerText = `Showing ${filtered.length} result(s)`;
}

function loadSubscriptionUsers() {
  const tbody = document.getElementById("subList");
  tbody.innerHTML = "🔄 Loading...";

  db.ref("users").once("value").then(snap => {
    tbody.innerHTML = "";
    const users = snap.val() || {};
    const filtered = Object.entries(users).filter(([_, data]) => data.isSubscribed);

    if (filtered.length === 0) {
      tbody.innerHTML = "<tr><td colspan='6'><em>No subscribed users found.</em></td></tr>";
      return;
    }

    filtered.forEach(([uid, data]) => {
      const tr = document.createElement("tr");

      const email = data.email || "N/A";
      const txn = data.txnId || "N/A";
      const date = data.subscriptionDate ? new Date(data.subscriptionDate).toLocaleString() : "N/A";
      const status = data.isSubscribed ? "✅ Active" : "❌ Inactive";

      tr.innerHTML = `
        <td>${email}</td>
        <td>${uid}</td>
        <td>${txn}</td>
        <td>${date}</td>
        <td>${status}</td>
        <td>
          <button onclick="toggleSub('${uid}', ${data.isSubscribed})" class="button">
            ${data.isSubscribed ? "Disable ❌" : "Enable ✅"}
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });
  });
}

function toggleSub(uid, isSubscribed) {
  db.ref(`users/${uid}`).update({ isSubscribed: !isSubscribed }).then(() => {
    alert("✅ Subscription status updated.");
    loadSubscriptionUsers();
  });
}

// Trigger when switching to subscription tab
function switchSection(id) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  if (id === "subscription") {
    loadSubscriptionUsers();
  }
}
