<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# API Test Recorder Browser Extension

This is a Chrome browser extension project that records XHR/API calls made by web pages. It specifically focuses on capturing requests that are relevant for creating API tests, filtering out non-relevant resources like images, stylesheets, etc.

## Project Structure

- `manifest.json` - Extension configuration
- `popup.html` - User interface with record/stop button
- `js/popup.js` - Popup UI logic
- `js/background.js` - Background service worker for API monitoring
- `js/content.js` - Content script for request interception
- `images/` - Icon files

## API Usage

The extension uses Chrome Extension APIs including:
- `chrome.webRequest` - For monitoring network requests
- `chrome.scripting` - For injecting JavaScript into pages
- `chrome.storage` - For storing captured API data
- `chrome.runtime` - For message passing between components

## Implementation Details

- Uses Manifest V3 for modern extension development
- Intercepts XMLHttpRequest calls
- Applies filtering to capture only API-relevant requests
- Preserves original functionality of intercepted APIs
- Transforms record button to stop button during recording
