# API Test Recorder Browser Extension

A simple browser extension that records XHR and API calls made by the current tab, specifically designed to capture requests that are relevant for creating API tests.

## Features

- Record XHR/API calls happening in the current tab
- Filters out non-relevant requests (images, stylesheets, etc.)
- Focuses on capturing requests useful for API testing
- Prominent record/stop button interface
- Capture request and response details including:
  - URL
  - Method
  - Headers
  - Request body
  - Response body
  - Status code
- Export captured API calls as JSON for test creation

## Installation

1. Clone this repository
2. Open Chrome browser and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your browser toolbar

## Usage

1. Navigate to the website where you want to record API calls
2. Click the extension icon to open the popup
3. Click the "Record API Calls" button to start recording
4. Perform actions on the website to trigger API calls
5. Click the "Stop Recording" button when done
6. Click "Export Data" to download the captured API calls as a JSON file

## Development

This extension uses:
- Chrome Extension Manifest V3
- Background service worker for API call monitoring
- Content script for intercepting XHR and Fetch requests
- Popup UI for user interaction

## Files Structure

- `manifest.json` - Extension configuration
- `popup.html` - User interface
- `js/popup.js` - Popup logic
- `js/background.js` - Background service worker
- `js/content.js` - Content script
- `images/` - Icon files
