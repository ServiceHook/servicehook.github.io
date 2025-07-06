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
    if (option === "custom" && custom) {
      return new Date(custom).getTime();
    }
    const now = Date.now();
    switch (option) {
      case "1h": return now + 3600000;
      case "1d": return now + 86400000;
      case "7d": return now + 604800000;
      default: return null;
    }
  }

  function handleExpiryChange() {
    const expiry = document.getElementById("expiry").value;
    document.getElementById("customExpiry").style.display = expiry === "custom" ? "block" : "none";
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      alert("✅ Link copied to clipboard!");
    }).catch(() => {
      alert("❌ Failed to copy.");
    });
  }

  function shareLink(link) {
    if (navigator.share) {
      navigator.share({
        title: "Check out this link!",
        text: "Here's something cool for you:",
        url: link
      }).catch(err => alert("❌ Share failed: " + err));
    } else {
      alert("This browser doesn't support the share sheet.");
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

    if (!longUrl.startsWith("http://") && !longUrl.startsWith("https://")) {
      longUrl = "https://" + longUrl;
    }

    if (!isValidUrl(longUrl)) {
      updateResultBox("❌ Invalid URL. Please include https://", false);
      return;
    }

    if (!alias) {
      const random = Math.floor(1000 + Math.random() * 9000);
      alias = "link" + random;
      document.getElementById("customAlias").value = alias;
    }

    if (!alias.match(/^[a-zA-Z0-9_-]+$/)) {
      updateResultBox("❌ Alias must use only letters, numbers, - or _", false);
      return;
    }

    const ref = db.ref("links/" + alias);
    showLoader(true);

    ref.once("value").then(snapshot => {
      if (snapshot.exists()) {
        showLoader(false);
        updateResultBox("❌ Alias already taken. Try another.", false);
      } else {
        const expiryTimestamp = getExpiryTimestamp(expiryOpt, customExpiry);

        ref.set({
          url: longUrl,
          password: password || null,
          createdAt: Date.now(),
          expiresAt: expiryTimestamp || null
        }, error => {
          showLoader(false);
          if (error) {
            updateResultBox("❌ Failed to save. Try again.", false);
          } else {
            const shortUrl = `${location.origin}/file/?alias=${alias}`;
            updateResultBox(`
              <div class="og-card">
                <img src="https://api.apiflash.com/v1/urltoimage?access_key=b0e5bc53bdf0417eb10f041ec400ebaf&url=${encodeURIComponent(shortUrl)}" alt="Preview of ${shortUrl}" />

                <div class="og-info">
                  <h3>🔗 Short Link Created!</h3>
                  <p>${shortUrl}</p>
                  <div class="share-buttons">
                    <a href="https://wa.me/?text=${encodeURIComponent(shortUrl)}" target="_blank">📱 WhatsApp</a>
                    <a href="https://t.me/share/url?url=${encodeURIComponent(shortUrl)}" target="_blank">📨 Telegram</a>
                    <a href="https://www.instagram.com" target="_blank">📸 Instagram</a>
                    <a href="https://www.youtube.com" target="_blank">▶️ YouTube</a>
                    <a onclick="shareLink('${shortUrl}')" style="cursor:pointer;">➕ More</a>
                  </div>
                </div>
              </div>
              <br>
              <button class="button" onclick="copyToClipboard('${shortUrl}')">📋 Copy</button><br><br>
              <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(shortUrl)}&size=150x150" alt="QR Code" />
            `, true);
          }
        });
      }
    });
  }
