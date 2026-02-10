// VERSION: SECURE_ENV_LOAD
let db;
let ADMIN_EMAIL = ""; // Fetched dynamically

// --- INITIALIZATION ---
async function initAdminApp() {
  try {
    const response = await fetch('/api/get_config');
    const config = await response.json();
    
    ADMIN_EMAIL = config.adminEmail; 
    firebase.initializeApp(config.firebase);
    db = firebase.database();

    // Check Auth AFTER config is loaded
    firebase.auth().onAuthStateChanged(user => {
      if (user && user.email === ADMIN_EMAIL) {
        initAdminPanel();
      } else {
        document.getElementById("loginSection").style.display = "flex";
        document.getElementById("adminContent").style.display = "none";
      }
    });

  } catch (err) {
    console.error("Admin init failed", err);
    showToast("Failed to load admin config", "error");
  }
}

initAdminApp();

// --- TOAST SYSTEM ---
function showToast(message, type = 'neutral') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-msg">${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// --- AUTH ---
function login() {
  const email = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const btn = document.querySelector(".login-card button");

  btn.innerText = "Verifying...";
  btn.disabled = true;

  firebase.auth().signInWithEmailAndPassword(email, password)
    .then(userCred => {
      if (userCred.user.email !== ADMIN_EMAIL) {
        showToast("Access Denied: Not an Admin", "error");
        firebase.auth().signOut();
      } else {
        // Observer in initAdminApp() will trigger initAdminPanel()
      }
    })
    .catch(err => {
      showToast(err.message, "error");
      document.getElementById("loginError").innerText = "❌ " + err.message;
    })
    .finally(() => {
      btn.innerText = "Login to Dashboard";
      btn.disabled = false;
    });
}

function initAdminPanel() {
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("adminContent").style.display = "flex";
  switchSection('dashboard');
  loadDashboard();
  loadDonationStats();
  checkPendingBills();
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

  if(id === 'manage') loadLinks();
  if(id === 'ban') { loadBannedUsers(); loadBannedIps(); }
  if(id === 'billing') loadBilling();
  if(id === 'donations') loadDonations();
  if(id === 'users') loadApiUsers(); 
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
      if (link.createdAt && new Date(link.createdAt).toDateString() === todayStr) todayCount++;
    });

    document.getElementById("todayCount").innerText = todayCount;
    document.getElementById("totalCount").innerText = values.length;

    // 2. Recent Links List
    const last = Object.entries(data).slice(-5).reverse();
    const list = document.getElementById("lastLinks");
    list.innerHTML = "";
    last.forEach(([alias, info]) => {
      const safeUrl = info.url ? info.url : "#";
      const displayUrl = safeUrl.substring(0, 40);

      const li = document.createElement("li");
      li.style.background = "rgba(255,255,255,0.03)";
      li.style.padding = "10px";
      li.style.marginBottom = "8px";
      li.style.borderRadius = "8px";
      li.innerHTML = `
        <strong style="color:var(--primary-accent);">${alias}</strong> 
        <span style="color:var(--text-muted);"> → ${displayUrl}...</span>
      `;
      list.appendChild(li);
    });

    // 3. Render Chart
    const attemptRender = (retryCount = 0) => {
        if(typeof Chart !== "undefined") {
            renderGrowthChart(values);
        } else if (retryCount < 3) {
            setTimeout(() => attemptRender(retryCount + 1), 1000);
        }
    };
    attemptRender();
  });
}


function formatCurrencyINR(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}


async function fetchDonationsFromApi() {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();

  const res = await fetch('/api/donations', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.status !== 'success') {
    throw new Error(payload.message || 'Unable to fetch donations');
  }

  return payload;
}

function loadDonationStats() {
  fetchDonationsFromApi().then((payload) => {
    const countEl = document.getElementById('donationCount');
    const amountEl = document.getElementById('donationTotalAmount');

    if (countEl) countEl.innerText = payload.stats?.count || 0;
    if (amountEl) amountEl.innerText = formatCurrencyINR(payload.stats?.totalAmount || 0);
  }).catch(() => {
    const countEl = document.getElementById('donationCount');
    const amountEl = document.getElementById('donationTotalAmount');
    if (countEl) countEl.innerText = '0';
    if (amountEl) amountEl.innerText = '₹0';
  });
}

function renderGrowthChart(links) {
  const canvas = document.getElementById('growthChart');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const labels = [];
  const dataPoints = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const count = links.filter(l => l.createdAt && new Date(l.createdAt).toDateString() === d.toDateString()).length;
    dataPoints.push(count);
  }

  if (growthChartInstance) growthChartInstance.destroy();
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

  growthChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'New Links', data: dataPoints, borderColor: '#6366f1',
        backgroundColor: gradient, borderWidth: 2, pointBackgroundColor: '#fff',
        fill: true, tension: 0.4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
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
    const safeUrl = info.url ? info.url : "#";
    const displayUrl = safeUrl.substring(0, 30);

    db.ref("clicks/" + alias).once("value").then(clickSnap => {
      const tr = document.createElement("tr");
      const clicks = clickSnap.exists() ? Object.keys(clickSnap.val()).length : 0;
      tr.innerHTML = `
        <td><strong>${alias}</strong></td>
        <td><a href="${safeUrl}" target="_blank">${displayUrl}...</a></td>
        <td>${clicks}</td>
        <td>
          <div class="action-group">
            <button onclick="showDetails('${alias}', this)" class="button btn-sm">📈</button>
            <button onclick="deleteLink('${alias}')" class="button btn-sm btn-danger">🗑️</button>
            <button onclick="banUser('${info.userEmail || ''}')" class="button btn-sm btn-danger">🚫</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
  document.getElementById("pageInfo").innerText = `Page ${Math.floor(currentIndex / pageSize) + 1}`;
}

function showNextBatch() {
  if (currentIndex + pageSize < allLinks.length) { currentIndex += pageSize; renderBatch(); }
}
function showPrevBatch() {
  if (currentIndex >= pageSize) { currentIndex -= pageSize; renderBatch(); }
}

function deleteLink(alias) {
  if (confirm("Delete " + alias + "?")) {
    db.ref("links/" + alias).remove();
    db.ref("clicks/" + alias).remove();
    showToast("Link deleted", "success");
    loadLinks();
  }
}

function showDetails(alias, btn) {
  const row = btn.closest("tr");
  let nextRow = row.nextElementSibling;
  if (nextRow && nextRow.classList.contains("details-row")) { nextRow.remove(); return; }

  db.ref("clicks/" + alias).once("value").then(snap => {
    const clicks = snap.val();
    const detailRow = document.createElement("tr");
    detailRow.className = "details-row";
    const td = document.createElement("td");
    td.colSpan = 4;
    
    if (!clicks) td.innerHTML = "<div class='detail-box'><em>No click data.</em></div>";
    else td.innerHTML = Object.values(clicks).map(c => `
      <div class="detail-box">
        <div><b>Time:</b> ${new Date(c.timestamp).toLocaleString()}</div>
        <div><b>Loc:</b> ${c.city || '?'}, ${c.country || 'N/A'}</div>
      </div>
    `).join('');
    
    detailRow.appendChild(td);
    row.parentNode.insertBefore(detailRow, row.nextSibling);
  });
}

function searchLinks() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  const tbody = document.querySelector("#urlTable tbody");
  tbody.innerHTML = "";
  const filtered = allLinks.filter(([alias, info]) => {
      const url = info.url || "";
      return alias.toLowerCase().includes(query) || url.toLowerCase().includes(query);
  });
  
  filtered.slice(0, pageSize).forEach(([alias, info]) => {
     const safeUrl = info.url || "#";
     const tr = document.createElement("tr");
     tr.innerHTML = `
        <td><strong>${alias}</strong></td>
        <td><a href="${safeUrl}" target="_blank">${safeUrl.substring(0, 30)}...</a></td>
        <td>-</td>
        <td><div class="action-group"><button onclick="deleteLink('${alias}')" class="button btn-sm btn-danger">🗑️</button></div></td>
      `;
      tbody.appendChild(tr);
  });
}

// --- API USERS LOGIC ---
async function loadApiUsers() {
  const tbody = document.querySelector("#apiUserTable tbody");
  tbody.innerHTML = "<tr><td colspan='4' style='text-align:center'>Fetching users & cross-referencing emails...</td></tr>";

  try {
    const keysSnap = await db.ref("api_keys").once("value");
    if (!keysSnap.exists()) {
      tbody.innerHTML = "<tr><td colspan='4' style='text-align:center'>No API users found.</td></tr>";
      return;
    }

    const linksSnap = await db.ref("links").once("value");
    const uidToEmailMap = {};
    if (linksSnap.exists()) {
        linksSnap.forEach(child => {
            const l = child.val();
            if (l.userId && l.userEmail && l.userEmail !== "null") {
                uidToEmailMap[l.userId] = l.userEmail;
            }
        });
    }

    const users = [];
    keysSnap.forEach(child => {
        users.push({ key: child.key, ...child.val() });
    });

    users.sort((a, b) => (b.limit || 0) - (a.limit || 0));

    tbody.innerHTML = ""; 

    users.forEach(u => {
      const isPaid = (u.limit || 50) > 50;
      const tr = document.createElement("tr");
      
      if (isPaid) tr.style.background = "rgba(34, 197, 94, 0.1)";

      const resolvedEmail = u.email || uidToEmailMap[u.uid] || null;

      const displayUid = u.uid 
          ? `<span style="color:#60a5fa; font-family:monospace;">${u.uid}</span>` 
          : '<span style="color:red">No UID</span>';
          
      const displayEmail = resolvedEmail 
          ? `<div style="color:#f8fafc; font-size:0.9rem;">${resolvedEmail}</div>` 
          : `<div style="color:#94a3b8; font-size:0.8rem; font-style:italic;">Email not linked</div>`;

      tr.innerHTML = `
        <td>
           ${displayEmail}
           <div style="font-size:0.75rem; color:#94a3b8; margin-top:4px;">UID: ${displayUid}</div>
        </td>
        <td>
           <b style="font-size:1.1rem;">${u.usage || 0}</b> <span style="color:#94a3b8">/ ${u.limit || 50}</span>
        </td>
        <td>
            ${isPaid ? '<span style="color:#4ade80; font-weight:bold;">PAID</span>' : '<span style="color:#94a3b8;">Free</span>'}
        </td>
        <td>
           <div class="action-group" style="flex-wrap: wrap; gap: 5px;">
             <button onclick="changeUsageLimit('${u.key}', ${u.limit || 50})" class="button btn-sm" style="background:#4CAF50;">✏️ Edit Limit</button>
             <button onclick="resetUserLimit('${u.key}')" class="button btn-sm" style="background:#ef4444;">Reset Usage</button>
           </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan='4' style='color:#ef4444; text-align:center'>Error loading users: ${error.message}</td></tr>`;
  }
}

function changeUsageLimit(apiKey, currentLimit) {
    const newLimit = prompt(`Enter new daily/monthly limit for this key:`, currentLimit);
    if (newLimit !== null && newLimit.trim() !== "" && !isNaN(newLimit)) {
        db.ref(`api_keys/${apiKey}`).update({ limit: parseInt(newLimit) })
          .then(() => {
              showToast("Limit updated successfully!", "success");
              loadApiUsers(); 
          })
          .catch(err => showToast("Error: " + err.message, "error"));
    }
}

function resetUserLimit(apiKey) {
    if(confirm("Reset usage for this key to 0?")) {
        db.ref(`api_keys/${apiKey}/usage`).set(0).then(() => {
            showToast("Usage reset successfully", "success");
            loadApiUsers();
        });
    }
}

// --- BAN SYSTEM (EMAILS) ---
function banUser(email) {
  if (!email) return showToast("No email associated", "error");
  if(confirm(`Ban user ${email}?`)) {
      db.ref("bannedEmails/" + btoa(email)).set(true)
        .then(() => {
          showToast("User banned", "success");
          loadBannedUsers();
        })
        .catch(err => showToast(err.message, "error"));
  }
}

function unbanUser(encodedEmail) {
  db.ref("bannedEmails/" + encodedEmail).remove()
    .then(() => {
      showToast("User unbanned", "success");
      loadBannedUsers();
    });
}

function loadBannedUsers() {
  db.ref("bannedEmails").once("value").then(snap => {
    const list = document.getElementById("bannedList");
    list.innerHTML = "";
    if(!snap.exists()) {
       list.innerHTML = "<li>No banned users.</li>";
       return;
    }
    Object.keys(snap.val() || {}).forEach(encodedEmail => {
      const li = document.createElement("li");
      li.style.marginBottom = "8px";
      li.innerHTML = `<span>${atob(encodedEmail)}</span> <button onclick="unbanUser('${encodedEmail}')" class="button btn-sm btn-danger" style="margin-left:10px;">Unban</button>`;
      list.appendChild(li);
    });
  });
}

// --- BAN SYSTEM (IPs) ---
function manualBanIp() {
  const ip = document.getElementById('ipInput').value.trim();
  if(!ip) return showToast("Please enter an IP", "error");
  
  db.ref("bannedIps/" + btoa(ip)).set(true)
    .then(() => {
      showToast("IP Banned", "success");
      document.getElementById('ipInput').value = "";
      loadBannedIps();
    })
    .catch(err => showToast(err.message, "error"));
}

function unbanIp(encodedIp) {
  db.ref("bannedIps/" + encodedIp).remove()
    .then(() => {
      showToast("IP Unbanned", "success");
      loadBannedIps();
    });
}

function loadBannedIps() {
  db.ref("bannedIps").once("value").then(snap => {
    const list = document.getElementById("bannedIpList");
    list.innerHTML = "";
    if(!snap.exists()) {
       list.innerHTML = "<li>No banned IPs.</li>";
       return;
    }
    Object.keys(snap.val() || {}).forEach(encodedIp => {
      const li = document.createElement("li");
      li.style.marginBottom = "8px";
      li.innerHTML = `<span>${atob(encodedIp)}</span> <button onclick="unbanIp('${encodedIp}')" class="button btn-sm btn-danger" style="margin-left:10px;">Unban</button>`;
      list.appendChild(li);
    });
  });
}

// --- BILLING SYSTEM ---
function loadBilling() {
  const tbody = document.querySelector("#billingTable tbody");
  tbody.innerHTML = "<tr><td colspan='5'>Loading requests...</td></tr>";

  db.ref("payment_requests").once("value").then(snap => {
    tbody.innerHTML = "";
    if (!snap.exists()) {
      tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No pending requests.</td></tr>";
      return;
    }

    snap.forEach(child => {
      const id = child.key;
      const req = child.val();
      const displayUid = req.userId ? req.userId.substring(0,6) : "Unknown";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
            <div style="font-weight:bold;">${req.userEmail || "No Email"}</div>
            <div style="font-size:0.8rem; color:#94a3b8;">UID: ${displayUid}...</div>
        </td>
        <td>
            <div style="color:#6366f1;">${req.planName}</div>
            <div style="font-size:0.8rem; color:#4ade80;">+${req.requestedLimit} Links</div>
        </td>
        <td style="font-family:monospace; color:#fbbf24;">${req.txnId}</td>
        <td style="color:#4ade80; font-weight:bold;">₹${req.amount}</td>
        <td>
          <div class="action-group">
            <button onclick="approvePlan('${id}', '${req.userId}', ${req.requestedLimit})" class="button btn-sm" style="background:#22c55e;">Approve</button>
            <button onclick="rejectPlan('${id}')" class="button btn-sm btn-danger">Reject</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
}

function approvePlan(reqId, userId, packLimit) {
  if(!confirm(`Confirm payment? This will ADD ${packLimit} links to the user's existing limit.`)) return;

  db.ref(`users/${userId}/api_key`).once("value").then(snap => {
    const apiKey = snap.val();
    
    if (!apiKey) {
      alert("Error: User has not generated an API key yet.");
      return;
    }

    const keyRef = db.ref(`api_keys/${apiKey}`);
    
    keyRef.once("value").then(keySnap => {
      const data = keySnap.val() || {};
      const currentLimit = parseInt(data.limit) || 0;
      const amountToAdd = parseInt(packLimit) || 0;
      const newTotal = currentLimit + amountToAdd;

      keyRef.update({ limit: newTotal })
  .then(() => {
    return db.ref(`payment_requests/${reqId}`).remove(); 
  })
  .then(() => {
    showToast(`Success! Limit upgraded: ${currentLimit} ➝ ${newTotal}`, "success");
    loadBilling(); 
  })
  .catch(err => showToast("Error: " + err.message, "error"));
    });
  });
}

function rejectPlan(reqId) {
  if(confirm("Reject this request?")) {
    db.ref(`payment_requests/${reqId}`).remove()
      .then(() => {
        showToast("Request rejected", "neutral");
        loadBilling();
      })
      .catch(err => showToast("Error: " + err.message, "error"));
  }
}

function checkPendingBills() {
    db.ref("payment_requests").on("value", snap => {
        const badge = document.getElementById("billBadge");
        if(badge) badge.style.display = snap.exists() ? "inline-block" : "none";
    });
}


function loadDonations() {
  const tbody = document.querySelector('#donationsTable tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6">Loading donations...</td></tr>';

  fetchDonationsFromApi().then((payload) => {
    const donations = payload.donations || [];

    if (!donations.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No donations yet.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    donations.forEach((d) => {
      const tr = document.createElement('tr');
      const donorLabel = d.anonymous ? 'Anonymous' : (d.donorName || 'Unknown');
      const emailLine = d.donorEmail ? `<div style="font-size:0.8rem; color:#94a3b8;">${d.donorEmail}</div>` : '';
      const date = d.createdAt ? new Date(d.createdAt).toLocaleString() : '-';
      const paymentId = d.paymentId || '-';
      const note = (d.donorNote || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      tr.innerHTML = `
        <td>${date}</td>
        <td><strong>${donorLabel}</strong>${emailLine}</td>
        <td>${d.purpose || 'General support'}</td>
        <td style="color:#4ade80; font-weight:600;">₹${d.amount || 0}</td>
        <td style="font-family:monospace; color:#fbbf24;">${paymentId}</td>
        <td style="max-width:280px; white-space:normal;">${note}</td>
      `;
      tbody.appendChild(tr);
    });

    loadDonationStats();
  }).catch((err) => {
    tbody.innerHTML = `<tr><td colspan="6" style="color:#ef4444; text-align:center;">Failed to load donations: ${err.message}</td></tr>`;
  });
}

function exportDonationsCSV() {
  fetchDonationsFromApi().then((payload) => {
    const donations = payload.donations || [];
    if (!donations.length) {
      showToast('No donations available for export', 'error');
      return;
    }

    const rows = [['date', 'donor_name', 'email', 'amount_inr', 'purpose', 'payment_id', 'note']];
    donations.forEach((d) => {
      rows.push([
        d.createdAt ? new Date(d.createdAt).toISOString() : '',
        d.anonymous ? 'Anonymous' : (d.donorName || ''),
        d.donorEmail || '',
        String(d.amount || 0),
        d.purpose || '',
        d.paymentId || '',
        (d.donorNote || '').replace(/\n/g, ' ').replace(/\r/g, ' ')
      ]);
    });

    const csv = rows.map((r) => r.map((cell) => {
      const value = String(cell || '');
      return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jachu-donations-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showToast('Donations exported', 'success');
  }).catch((err) => showToast('Export failed: ' + err.message, 'error'));
}