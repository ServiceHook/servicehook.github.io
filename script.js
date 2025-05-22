emailjs.init("2iAO2hcDv-c-ulN4W");

document.getElementById("serviceForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const serviceType = document.getElementById("serviceType").value;
  const message = document.getElementById("message").value.trim();

  const requestRef = db.ref("serviceRequests").push();
  requestRef.set({
    name,
    email,
    serviceType,
    message,
    status: "Pending",
    timestamp: new Date().toISOString()
  });

  // Send email notification via EmailJS
  emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", {
    name,
    email,
    service: serviceType,
    message
  }).then(() => {
    document.getElementById("statusMsg").classList.remove("hidden");
    document.getElementById("serviceForm").reset();
  });
});
