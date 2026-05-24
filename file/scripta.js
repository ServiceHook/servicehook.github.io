// VERSION: SECURE_ENV_LOAD_V3 (Razorpay & Coupons Updated)
let db;
let ADMIN_EMAIL = ""; 
let allDonations = []; 

// --- INITIALIZATION ---
async function initAdminApp() {
  try {
    const response = await fetch('/api/get_config');
    const config = await response.json();
    
    ADMIN_EMAIL = config.adminEmail; 
    firebase.initializeApp(config.firebase);
    db = firebase.database();

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
  if(id === 'coupons') loadCoupons();
  if(id === 'donations') loadDonations(); 
  if(id === 'users') loadApiUsers(); 
  if(id === 'tickets') loadTickets();
}

// --- DASHBOARD & CHARTS ---
let growthChartInstance = null;

function loadDashboard() {
  db.ref("links").once("value").then(snap => {
    const data = snap.val() || {};
    const values = Object.values(data);
    
    const todayStr = new Date().toDateString();
    let todayCount = 0;
    values.forEach(link => {
      if (link.createdAt && new Date(link.createdAt).toDateString() === todayStr) todayCount++;
    });

    document.getElementById("todayCount").innerText = todayCount;
    document.getElementById("totalCount").innerText = values.length;

    const last = Object.entries(data).slice(-5).reverse();
    const list = document.getElementById("lastLinks");
    list.innerHTML = "";
    last.forEach(([alias, info]) => {
      const displayUrl = (info.url || "#").substring(0, 40);
      const li = document.createElement("li");
      li.style.background = "rgba(255,255,255,0.03)";
      li.style.padding = "10px";
      li.style.marginBottom = "8px";
      li.style.borderRadius = "8px";
      li.innerHTML = `<strong style="color:var(--primary-accent);">${alias}</strong> <span style="color:var(--text-muted);"> → ${displayUrl}...</span>`;
      list.appendChild(li);
    });

    const attemptRender = (retryCount = 0) => {
        if(typeof Chart !== "undefined") renderGrowthChart(values);
        else if (retryCount < 3) setTimeout(() => attemptRender(retryCount + 1), 1000);
    };
    attemptRender();
  });
}

function formatCurrencyINR(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

async function loadDonationStats() {
  try {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const token = await user.getIdToken();

    const response = await fetch('/api/donations', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    const data = await response.json();
    if(data.status === 'success' && data.stats) {
      document.getElementById('donationCount').innerText = data.stats.count;
      document.getElementById('donationTotalAmount').innerText = formatCurrencyINR(data.stats.totalAmount);
    }
  } catch(e) {
    console.warn("Stats load failed", e);
  }
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
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
  document.getElementById("pageInfo").innerText = `Page ${Math.floor(currentIndex / pageSize) + 1}`;
}
function showNextBatch() { if (currentIndex + pageSize < allLinks.length) { currentIndex += pageSize; renderBatch(); } }
function showPrevBatch() { if (currentIndex >= pageSize) { currentIndex -= pageSize; renderBatch(); } }

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
  tbody.innerHTML = "<tr><td colspan='4' style='text-align:center'>Fetching users...</td></tr>";

  try {
    const keysSnap = await db.ref("api_keys").once("value");
    if (!keysSnap.exists()) return tbody.innerHTML = "<tr><td colspan='4' style='text-align:center'>No API users found.</td></tr>";

    const users = [];
    keysSnap.forEach(child => { users.push({ key: child.key, ...child.val() }); });
    users.sort((a, b) => (b.limit || 0) - (a.limit || 0));

    tbody.innerHTML = ""; 
    users.forEach(u => {
      const isPaid = (u.limit || 50) > 50;
      const tr = document.createElement("tr");
      if (isPaid) tr.style.background = "rgba(34, 197, 94, 0.1)";

      tr.innerHTML = `
        <td>
           <div style="color:#f8fafc; font-size:0.9rem;">${u.email || 'Unknown'}</div>
           <div style="font-size:0.75rem; color:#94a3b8; margin-top:4px;">UID: <span style="color:#60a5fa; font-family:monospace;">${u.uid || 'N/A'}</span></div>
        </td>
        <td><b style="font-size:1.1rem;">${u.usage || 0}</b> <span style="color:#94a3b8">/ ${u.limit || 50}</span></td>
        <td>${isPaid ? '<span style="color:#4ade80; font-weight:bold;">PAID</span>' : '<span style="color:#94a3b8;">Free</span>'}</td>
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
    tbody.innerHTML = `<tr><td colspan='4' style='color:#ef4444; text-align:center'>Error loading users: ${error.message}</td></tr>`;
  }
}

function changeUsageLimit(apiKey, currentLimit) {
    const newLimit = prompt(`Enter new daily/monthly limit for this key:`, currentLimit);
    if (newLimit !== null && newLimit.trim() !== "" && !isNaN(newLimit)) {
        db.ref(`api_keys/${apiKey}`).update({ limit: parseInt(newLimit) })
          .then(() => { showToast("Limit updated successfully!", "success"); loadApiUsers(); loadBilling(); })
          .catch(err => showToast("Error: " + err.message, "error"));
    }
}

function resetUserLimit(apiKey) {
    if(confirm("Reset usage for this key to 0?")) {
        db.ref(`api_keys/${apiKey}/usage`).set(0).then(() => {
            showToast("Usage reset successfully", "success"); loadApiUsers();
        });
    }
}

// --- BILLING / TRANSACTIONS SYSTEM ---
function loadBilling() {
  const tbody = document.querySelector("#billingTable tbody");
  tbody.innerHTML = "<tr><td colspan='7'>Loading transactions...</td></tr>";

  db.ref("payment_requests").once("value").then(snap => {
    tbody.innerHTML = "";
    if (!snap.exists()) return tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>No transactions found.</td></tr>";

    const requests = [];
    
    // FIX: Added curly braces so .push() doesn't return 'true' and stop the Firebase loop!
    snap.forEach(c => { 
        requests.push({ id: c.key, ...c.val() }); 
    });
    
    requests.sort((a,b) => b.timestamp - a.timestamp); // Newest first

    requests.forEach(req => {
      const displayUid = req.userId ? req.userId.substring(0,6) : "Unknown";
      const statusColor = req.status === "Refunded" ? "#ef4444" : (req.status === "Completed" ? "#22c55e" : "#fbbf24");
      
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="color:#94a3b8; font-size:0.8rem;">${new Date(req.timestamp).toLocaleString()}</td>
        <td>
            <div style="font-weight:bold;">${req.userEmail || "No Email"}</div>
            <div style="font-size:0.8rem; color:#94a3b8;">UID: ${displayUid}...</div>
        </td>
        <td>
            <div style="color:#6366f1;">${req.planName}</div>
            <div style="font-size:0.8rem; color:#4ade80;">+${req.requestedLimit} Links</div>
        </td>
        <td>
            <div style="font-family:monospace; color:#fbbf24; font-size:0.85rem;">${req.txnId}</div>
            ${req.coupon && req.coupon !== "None" ? `<div style="font-size:0.75rem; color:#f472b6;">Coupon: ${req.coupon}</div>` : ''}
        </td>
        <td style="color:#4ade80; font-weight:bold;">₹${req.amount}</td>
        <td><span style="color:${statusColor}; font-weight:bold;">${req.status || 'Unknown'}</span></td>
        <td>
          <div class="action-group" style="flex-wrap: wrap; max-width: 150px;">
            <button onclick="refundPayment('${req.id}')" class="button btn-sm" style="background:#f59e0b;" ${req.status==='Refunded'?'disabled':''}>Refund</button>
            <button onclick="revokePaymentLimit('${req.id}', '${req.userId}', ${req.requestedLimit})" class="button btn-sm btn-danger">Revoke Limit</button>
            <button onclick="banUser('${req.userEmail}')" class="button btn-sm" style="background:#ef4444;">Block User</button>
            <button onclick="deletePayment('${req.id}')" class="button btn-sm" style="background:transparent; border:1px solid #ef4444; color:#ef4444;">🗑️</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
}

function refundPayment(reqId) {
    if(confirm("Mark this transaction as Refunded? (You still need to process the actual refund via Razorpay dashboard)")) {
        db.ref(`payment_requests/${reqId}`).update({ status: "Refunded" }).then(() => {
            showToast("Transaction marked as Refunded", "success");
            loadBilling();
        });
    }
}

async function revokePaymentLimit(reqId, userId, requestedLimit) {
    if(!confirm(`This will SUBTRACT ${requestedLimit} links from the user's current limit. Continue?`)) return;

    try {
        const userSnap = await db.ref(`users/${userId}/api_key`).once("value");
        const apiKey = userSnap.val();
        if(!apiKey) return showToast("User API Key not found", "error");

        const keyRef = db.ref(`api_keys/${apiKey}`);
        const keySnap = await keyRef.once("value");
        const currentData = keySnap.val() || {};
        
        let newLimit = Math.max(50, (parseInt(currentData.limit) || 0) - parseInt(requestedLimit)); // Ensure it doesn't go below Free tier
        
        await keyRef.update({ limit: newLimit });
        
        // Add note to the billing record
        await db.ref(`payment_requests/${reqId}`).update({ status: "Revoked" });
        
        showToast(`Success! Limit revoked. New limit: ${newLimit}`, "success");
        loadBilling();
        loadApiUsers();

    } catch(err) {
        showToast("Error: " + err.message, "error");
    }
}

function deletePayment(reqId) {
    if(confirm("Permanently delete this transaction record?")) {
        db.ref(`payment_requests/${reqId}`).remove().then(() => {
            showToast("Record deleted", "neutral");
            loadBilling();
        });
    }
}


// --- COUPONS MANAGEMENT (NEW) ---
function loadCoupons() {
  const tbody = document.querySelector("#couponsTable tbody");
  tbody.innerHTML = "<tr><td colspan='4'>Loading coupons...</td></tr>";

  db.ref("coupons").once("value").then(snap => {
    tbody.innerHTML = "";
    if (!snap.exists()) return tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>No active coupons.</td></tr>";

    snap.forEach(child => {
      const code = child.key;
      const data = child.val();
      
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-family:monospace; font-weight:bold; color:#60a5fa;">${code}</td>
        <td style="color:#4ade80;">${data.discountPercent}%</td>
        <td>${data.active ? '<span style="color:#22c55e;">Active</span>' : '<span style="color:#ef4444;">Inactive</span>'}</td>
        <td>
          <button onclick="deleteCoupon('${code}')" class="button btn-sm btn-danger">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
}

function addCoupon() {
    const codeInput = document.getElementById("newCouponCode");
    const discInput = document.getElementById("newCouponDiscount");
    
    const code = codeInput.value.trim().toUpperCase();
    const discount = parseInt(discInput.value);

    if(!code || !discount || discount < 1 || discount > 100) {
        return showToast("Please enter a valid code and discount % (1-100)", "error");
    }

    db.ref(`coupons/${code}`).set({
        discountPercent: discount,
        active: true,
        createdAt: Date.now()
    }).then(() => {
        showToast("Coupon created!", "success");
        codeInput.value = "";
        discInput.value = "";
        loadCoupons();
    }).catch(err => showToast(err.message, "error"));
}

function deleteCoupon(code) {
    if(confirm(`Delete coupon ${code}?`)) {
        db.ref(`coupons/${code}`).remove().then(() => {
            showToast("Coupon deleted", "success");
            loadCoupons();
        });
    }
}

// --- BAN SYSTEM (EMAILS) ---
function banUser(email) {
  if (!email || email === "No Email") return showToast("No email associated", "error");
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
    .then(() => { showToast("User unbanned", "success"); loadBannedUsers(); });
}

function loadBannedUsers() {
  db.ref("bannedEmails").once("value").then(snap => {
    const list = document.getElementById("bannedList");
    list.innerHTML = "";
    if(!snap.exists()) return list.innerHTML = "<li>No banned users.</li>";
    
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
  
  db.ref("bannedIps/" + btoa(ip)).set(true).then(() => {
      showToast("IP Banned", "success");
      document.getElementById('ipInput').value = "";
      loadBannedIps();
  }).catch(err => showToast(err.message, "error"));
}

function unbanIp(encodedIp) {
  db.ref("bannedIps/" + encodedIp).remove().then(() => { showToast("IP Unbanned", "success"); loadBannedIps(); });
}

function loadBannedIps() {
  db.ref("bannedIps").once("value").then(snap => {
    const list = document.getElementById("bannedIpList");
    list.innerHTML = "";
    if(!snap.exists()) return list.innerHTML = "<li>No banned IPs.</li>";
    
    Object.keys(snap.val() || {}).forEach(encodedIp => {
      const li = document.createElement("li");
      li.style.marginBottom = "8px";
      li.innerHTML = `<span>${atob(encodedIp)}</span> <button onclick="unbanIp('${encodedIp}')" class="button btn-sm btn-danger" style="margin-left:10px;">Unban</button>`;
      list.appendChild(li);
    });
  });
}

// --- SECURE DONATION LOADER ---
async function loadDonations() {
  const tbody = document.querySelector('#donationsTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Loading donations via API...</td></tr>';

  try {
    const user = firebase.auth().currentUser;
    if (!user) return tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Authenticating...</td></tr>';
    
    const token = await user.getIdToken();
    const response = await fetch('/api/donations', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message || "API Error");

    allDonations = data.donations || [];
    renderDonations(allDonations);

    if (data.stats) {
      document.getElementById('donationCount').innerText = data.stats.count;
      document.getElementById('donationTotalAmount').innerText = formatCurrencyINR(data.stats.totalAmount);
    }
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6" style="color:#ef4444; text-align:center;">Failed to load donations: ${err.message}</td></tr>`;
  }
}

function renderDonations(list) {
    const tbody = document.querySelector('#donationsTable tbody');
    if (!list.length) return tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No donations found.</td></tr>';

    tbody.innerHTML = '';
    list.forEach((d) => {
        const tr = document.createElement('tr');
        const donorLabel = d.anonymous ? 'Anonymous' : (d.donorName || 'Unknown');
        const emailLine = d.donorEmail ? `<div style="font-size:0.8rem; color:#94a3b8;">${d.donorEmail}</div>` : '';
        const date = d.createdAt ? new Date(d.createdAt).toLocaleString() : '-';
        const note = (d.donorNote || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        tr.innerHTML = `
        <td>${date}</td>
        <td><strong>${donorLabel}</strong>${emailLine}</td>
        <td>${d.purpose || 'General support'}</td>
        <td style="color:#4ade80; font-weight:600;">₹${d.amount || 0}</td>
        <td style="font-family:monospace; color:#fbbf24;">${d.paymentId || '-'}</td>
        <td style="max-width:280px; white-space:normal;">${note}</td>
        `;
        tbody.appendChild(tr);
    });
}

function exportDonationsCSV() {
  const rows = [['date', 'donor', 'purpose', 'amount', 'payment_id', 'note']];
  const trs = document.querySelectorAll('#donationsTable tbody tr');
  
  if(!trs.length || trs[0].innerText.includes('No donations')) return showToast('No data to export', 'error');

  trs.forEach(tr => {
      const cols = tr.querySelectorAll('td');
      const rowData = [
          cols[0].innerText,
          cols[1].innerText.replace(/\n/g, ' '), 
          cols[2].innerText,
          cols[3].innerText.replace('₹', ''),
          cols[4].innerText,
          cols[5].innerText
      ];
      rows.push(rowData.map(c => `"${c.replace(/"/g, '""')}"`));
  });

  const csvContent = rows.map(e => e.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `donations-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// --- SUPPORT TICKETS LOGIC ---
function loadTickets() {
  const tbody = document.querySelector("#ticketsTable tbody");
  if(!tbody) return;
  tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Fetching tickets...</td></tr>";

  db.ref("tickets").once("value").then(snap => {
    tbody.innerHTML = "";
    if (!snap.exists()) return tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; color: var(--text-muted);'>No tickets found.</td></tr>";

    const tickets = [];
    snap.forEach(child => { tickets.push({ id: child.key, ...child.val() }); });
    tickets.sort((a, b) => b.createdAt - a.createdAt);

    tickets.forEach(t => {
      const tr = document.createElement("tr");
      const date = new Date(t.createdAt).toLocaleString();
      const statusColor = t.status === "Closed" ? "#94a3b8" : "#4ade80";
      
      let priorityColor = "#3b82f6";
      if (t.priority === "High") priorityColor = "#ef4444"; 
      if (t.priority === "Medium") priorityColor = "#f59e0b"; 
      
      tr.innerHTML = `
        <td style="font-size: 0.85rem; color: var(--text-muted);">${date}</td>
        <td><strong>${t.name}</strong><br><span style="font-size: 0.85rem; color: var(--text-muted);">${t.email}</span></td>
        <td>
          <div style="margin-bottom:4px; font-weight: 500;">${t.category}</div>
          <span style="font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.05); color: ${priorityColor}; border: 1px solid ${priorityColor};">${t.priority}</span>
        </td>
        <td style="max-width: 250px; white-space: normal; font-size: 0.9rem;">${(t.description || "").replace(/</g, "&lt;")}</td>
        <td style="color: ${statusColor}; font-weight: bold;">${t.status}</td>
        <td>
          <div class="action-group">
            ${t.status !== "Closed" 
              ? `<button onclick="closeTicket('${t.id}')" class="button btn-sm" style="background: #22c55e;">Resolve</button>` 
              : `<button onclick="deleteTicket('${t.id}')" class="button btn-sm btn-danger">Delete</button>`}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
}

function closeTicket(id) {
  if (confirm("Mark this ticket as resolved/closed?")) {
    db.ref("tickets/" + id).update({ status: "Closed" }).then(() => { showToast("Ticket closed", "success"); loadTickets(); });
  }
}

function deleteTicket(id) {
  if (confirm("Permanently delete this ticket record?")) {
    db.ref("tickets/" + id).remove().then(() => { showToast("Ticket deleted", "success"); loadTickets(); });
  }
}