// token.js

// This script runs in the context of app.keploy.io

// Function to check for the token in localStorage
function checkForToken() {
  const token = localStorage.getItem('token');
  if (token) {
    // Token found, send it to the background script
    chrome.runtime.sendMessage({ action: 'keployToken', token: token, closeTab: true });
    // Stop the interval once the token is found
    clearInterval(intervalId);
  }
}

// Check for the token every second
const intervalId = setInterval(checkForToken, 1000);