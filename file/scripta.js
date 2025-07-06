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

function switchSection(id) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

function login() {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  firebase.auth().signInWithEmailAndPassword(email, password)
    .then(userCred => {
      const user = userCred.user;
      if (user.email !== "ztenkammu@gmail.com") {
        document.getElementById("loginError").innerText = "❌ Access Denied";
        firebase.auth().signOut(); // kick out non-admins
      } else {
        document.getElementById("loginSection").style.display = "none";
        document.getElementById("dashboard").classList.remove("hidden");
        loadDashboard();
      }
    })
    .catch(err => {
      document.getElementById("loginError").innerText = "❌ " + err.message;
    });
}


function logout() {
  location.reload();
}

// ================= Dashboard =================
function loadDashboard() {
  db.ref("links").once("value").then(snap => {
    const data = snap.val() || {};
    const now = Date.now();
    let today = 0;
    const last = Object.entries(data).slice(-5).reverse();
    lastLinks.innerHTML = "";

    Object.values(data).forEach(link => {
      if (new Date(link.createdAt).toDateString() === new Date().toDateString()) {
        today++;
      }
    });

    document.getElementById("todayCount").innerText = today;
    document.getElementById("totalCount").innerText = Object.keys(data).length;
    last.forEach(([alias, info]) => {
      const li = document.createElement("li");
      li.innerHTML = `<a href="/file/?alias=${alias}" target="_blank">${alias}</a> - ${info.url}`;
      lastLinks.appendChild(li);
    });
  });
}

// ================= Manage =================
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
    <button onclick="showDetails('${alias}', this)" class="button">📈 Details</button>
	<button onclick="banUser('${info.userEmail || ''}')" class="button">🚫 Ban</button>
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
    nextRow.remove(); // collapse if open
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
        <div style="background:#1e293b; margin:6px 0; padding:10px; border-left:4px solid #3b82f6;">
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



function banUser(email) {
  if (!email) return alert("❌ No email associated with this link.");
  db.ref("bannedEmails/" + btoa(email)).set(true); // base64 to avoid dot error
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

function unbanUser(encodedEmail) {
  db.ref("bannedEmails/" + encodedEmail).remove();
  loadBannedUsers();
}

window.onload = () => loadBannedUsers();







// ================= Ban =================
function banIP() {
  const ip = document.getElementById("ipInput").value.trim();
  if (!ip) return alert("Enter a valid IP.");
  db.ref("banned/" + ip).set(true);
  loadBannedIPs();
}

function unban(ip) {
  db.ref("banned/" + ip).remove();
  loadBannedIPs();
}

function loadBannedIPs() {
  db.ref("banned").once("value").then(snap => {
    const list = document.getElementById("bannedList");
    list.innerHTML = "";
    Object.keys(snap.val() || {}).forEach(ip => {
      const li = document.createElement("li");
      li.innerHTML = `${ip} <button onclick="unban('${ip}')" class="button">Unban</button>`;
      list.appendChild(li);
    });
  });
}

window.onload = () => loadBannedIPs();
