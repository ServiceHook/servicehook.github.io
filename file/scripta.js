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

// --- AUTH ---
function login() {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const btn = document.querySelector(".login-card button");

  btn.innerText = "Verifying...";
  btn.disabled = true;

  firebase.auth().signInWithEmailAndPassword(email, password)
    .then(userCred => {
      const user = userCred.user;
      if (user.email !== "ztenkammu@gmail.com") {
        document.getElementById("loginError").innerText = "❌ Access Denied: Not an Admin";
        firebase.auth().signOut();
      } else {
        initAdminPanel();
      }
    })
    .catch(err => {
      document.getElementById("loginError").innerText = "❌ " + err.message;
    })
    .finally(() => {
      btn.innerText = "Login to Dashboard";
      btn.disabled = false;
    });
}

firebase.auth().onAuthStateChanged(user => {
  if (user && user.email === "ztenkammu@gmail.com") {
    initAdminPanel();
  } else {
    document.getElementById("loginSection").style.display = "flex";
    document.getElementById("adminContent").style.display = "none";
  }
});

function initAdminPanel() {
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("adminContent").style.display = "flex";
  switchSection('dashboard');
  loadDashboard();
}

function logout() {
  firebase.auth().signOut().then(() => location.reload());
}

function switchSection(id) {
  document.querySelectorAll('.section').forEach(sec => sec.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
  const activeNav = document.getElementById('nav-' + id);
  if(activeNav) activeNav.classList.add('active');
}

// --- DASHBOARD & CHARTS ---
let growthChartInstance = null;

function loadDashboard() {
  db.ref("links").once("value").then(snap => {
    const data = snap.val() || {};
    const values = Object.values(data);
    
    // 1. Basic Counts
    const todayStr = new Date().toDateString();
    let todayCount = 0;
    values.forEach(link => {
      if (new Date(link.createdAt).toDateString() === todayStr) todayCount++;
    });

    document.getElementById("todayCount").innerText = todayCount;
    document.getElementById("totalCount").innerText = values.length;

    // 2. Recent Links List
    const last = Object.entries(data).slice(-5).reverse();
    const list = document.getElementById("lastLinks");
    list.innerHTML = "";
    last.forEach(([alias, info]) => {
      const li = document.createElement("li");
      li.style.background = "rgba(255,255,255,0.03)";
      li.style.padding = "10px";
      li.style.marginBottom = "8px";
      li.style.borderRadius = "8px";
      li.innerHTML = `
        <strong style="color:var(--primary-accent);">${alias}</strong> 
        <span style="color:var(--text-muted);"> → ${info.url.substring(0, 40)}...</span>
      `;
      list.appendChild(li);
    });

    // 3. Render Growth Chart
    renderGrowthChart(values);
  });
}

function renderGrowthChart(links) {
  const ctx = document.getElementById('growthChart').getContext('2d');
  
  // Prepare labels (Last 7 days)
  const labels = [];
  const dataPoints = [];
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    
    // Count links for this day
    const count = links.filter(l => new Date(l.createdAt).toDateString() === dateStr).length;
    dataPoints.push(count);
  }

  // Destroy old chart if exists (prevents glitch on reload)
  if (growthChartInstance) growthChartInstance.destroy();

  // Create Gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)'); // Primary Accent
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

  growthChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'New Links',
        data: dataPoints,
        borderColor: '#6366f1',
        backgroundColor: gradient,
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#6366f1',
        fill: true,
        tension: 0.4 // Curve the lines
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index', intersect: false,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#fff', bodyColor: '#cbd5e1', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', precision: 0 }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

// --- MANAGE LINKS ---
let allLinks = [];
let currentIndex = 0;
const pageSize = 10;

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
        <td><strong>${alias}</strong></td>
        <td><a href="${info.url}" target="_blank">${info.url.substring(0, 50)}${info.url.length > 50 ? '...' : ''}</a></td>
        <td>${clicks}</td>
        <td>
          <div class="action-group">
            <button onclick="showDetails('${alias}', this)" class="button btn-sm">📈</button>
            <button onclick="deleteLink('${alias}')" class="button btn-sm btn-danger">🗑️</button>
            <button onclick="banUser('${info.userEmail || ''}')" class="button btn-sm btn-danger" title="Ban Creator">🚫</button>
          </div>
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
    nextRow.remove(); return;
  }

  db.ref("clicks/" + alias).once("value").then(snap => {
    const clicks = snap.val();
    const detailRow = document.createElement("tr");
    detailRow.className = "details-row";
    const td = document.createElement("td");
    td.colSpan = 4;

    if (!clicks) {
      td.innerHTML = "<div class='detail-box'><em>No click data available yet.</em></div>";
    } else {
      td.innerHTML = Object.values(clicks).map(c => `
        <div class="detail-box">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div><b>📅 Time:</b> ${new Date(c.timestamp).toLocaleString()}</div>
            <div><b>🌍 Loc:</b> ${c.city || '?'}, ${c.country || 'N/A'}</div>
            <div><b>📱 Device:</b> ${c.device || 'Unknown'}</div>
            <div><b>🔐 IP:</b> ${c.ip || 'Hidden'}</div>
          </div>
        </div>
      `).join('');
    }
    detailRow.appendChild(td);
    row.parentNode.insertBefore(detailRow, row.nextSibling);
  });
}

function searchLinks() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const tbody = document.querySelector("#urlTable tbody");
  tbody.innerHTML = "";

  const filtered = allLinks.filter(([alias, info]) =>
    alias.toLowerCase().includes(query) || info.url.toLowerCase().includes(query)
  );

  filtered.slice(0, pageSize).forEach(([alias, info]) => {
     const tr = document.createElement("tr");
     tr.innerHTML = `
        <td><strong>${alias}</strong></td>
        <td><a href="${info.url}" target="_blank">${info.url.substring(0, 50)}...</a></td>
        <td>-</td>
        <td>
          <div class="action-group">
             <button onclick="deleteLink('${alias}')" class="button btn-sm btn-danger">🗑️</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
  });
}

function banUser(email) {
  if (!email) return alert("❌ This link is anonymous (no email).");
  if(confirm(`Ban user ${email}?`)) {
      db.ref("bannedEmails/" + btoa(email)).set(true);
      loadBannedUsers();
  }
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
      li.innerHTML = `<span>${email}</span> <button onclick="unbanUser('${encodedEmail}')" class="button btn-sm">Unban</button>`;
      list.appendChild(li);
    });
  });
}

window.onload = () => {};