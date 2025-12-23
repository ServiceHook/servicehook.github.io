// scripta2.js - Admin Panel Upgrades

document.addEventListener('DOMContentLoaded', function() {
    // 1. Find the main "Load API Users" button
    const apiButton = document.getElementById('api-users-btn'); 

    if (apiButton) {
        console.log("Admin Panel: API Users button active.");
        apiButton.addEventListener('click', function() {
            fetchAndShowUsers();
        });
    }
});

// 2. The Main Function to Fetch and Build the UI
async function fetchAndShowUsers() {
    const outputDiv = document.getElementById('user-list-container');
    const API_URL = "https://jsonplaceholder.typicode.com/users"; 

    if(outputDiv) outputDiv.innerHTML = '<p>Loading users...</p>';

    try {
        const response = await fetch(API_URL);
        const users = await response.json();

        // Clear loading text
        if(outputDiv) outputDiv.innerHTML = '';

        // Loop through users and build the detailed cards
        users.forEach(user => {
            const userCard = document.createElement('div');
            
            // Basic Styling for the card (You can move this to CSS file)
            userCard.style.border = "1px solid #ddd";
            userCard.style.marginBottom = "15px";
            userCard.style.padding = "15px";
            userCard.style.borderRadius = "8px";
            userCard.style.backgroundColor = "#fff";

            // --- 1. USER ID & EMAIL (The new info) ---
            // We assume a default usage limit of 100 for display purposes
            const currentLimit = 100; 

            const infoHTML = `
                <div style="margin-bottom: 10px;">
                    <strong>User ID:</strong> <span style="color:blue">#${user.id}</span><br>
                    <strong>Email:</strong> ${user.email}<br>
                    <strong>Current Limit:</strong> <span id="limit-display-${user.id}">${currentLimit}</span> req/day
                </div>
            `;
            
            // Create a container for buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.style.display = "flex";
            buttonContainer.style.gap = "10px";

            // --- 2. RESET BUTTON (Existing) ---
            const resetBtn = document.createElement('button');
            resetBtn.innerText = "Reset Key";
            resetBtn.style.backgroundColor = "#ff4d4d"; // Red
            resetBtn.style.color = "white";
            resetBtn.onclick = function() {
                alert(`API Key reset for User ID: ${user.id}`);
            };

            // --- 3. CHANGE LIMIT BUTTON (New Upgrade) ---
            const limitBtn = document.createElement('button');
            limitBtn.innerText = "Change Usage Limit";
            limitBtn.style.backgroundColor = "#4CAF50"; // Green
            limitBtn.style.color = "white";
            
            // The Logic for Changing Limits
            limitBtn.onclick = function() {
                changeUsageLimit(user.id);
            };

            // Assemble the card
            userCard.innerHTML = infoHTML; // Add text
            buttonContainer.appendChild(resetBtn); // Add Reset Button
            buttonContainer.appendChild(limitBtn); // Add Limit Button
            userCard.appendChild(buttonContainer); // Add buttons to card
            
            if(outputDiv) outputDiv.appendChild(userCard);
        });

    } catch (error) {
        console.error(error);
        if(outputDiv) outputDiv.innerHTML = '<p style="color:red">Error loading users.</p>';
    }
}

// 3. Helper Function to Handle the Limit Change
function changeUsageLimit(userId) {
    // Ask admin for new limit
    let newLimit = prompt(`Enter new usage limit for User #${userId}:`, "1000");

    if (newLimit != null && newLimit !== "") {
        // Update the specific text on the screen
        const limitDisplay = document.getElementById(`limit-display-${userId}`);
        if(limitDisplay) {
            limitDisplay.innerText = newLimit;
            limitDisplay.style.color = "green";
            limitDisplay.style.fontWeight = "bold";
        }
        
        // Here you would normally send this data to your database
        console.log(`Update sent to server: User ${userId} limit set to ${newLimit}`);
        alert(`Success! Limit for User #${userId} changed to ${newLimit}`);
    }
}