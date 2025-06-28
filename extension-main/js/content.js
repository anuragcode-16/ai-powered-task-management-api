// Content script for API test recording
console.log('API Test Recorder content script loaded');

// Make the extension detectable by external UIs
window.__KEPLOY_EXTENSION_PRESENT__ = true;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getRecordingStatus') {
    console.log('Content script checking recording status:', window.__apiRecorderInjected || false);
    sendResponse({ isRecording: window.__apiRecorderInjected || false });
    return true; // Keep the message channel open for the async response
  } else if (message.action === 'debugContentScript') {
    // Add additional debug info
    console.log('Content script debug requested');
    sendResponse({
      scriptLoaded: true,
      pageUrl: window.location.href,
      messageEventListenersActive: !!window.onmessage,
      apiRecorderInjected: window.__apiRecorderInjected || false
    });
    return true; // Keep the message channel open for the async response
  }
});

// Forward XHR responses to the background script (filter client-side as well)
window.addEventListener('message', function(event) {
  // Make sure the message is from our page script and from the same origin
  if (event.data && event.data.type === 'API_RECORDER_RESPONSE') {
    console.log('Content script received API response:', {
      url: event.data.data.url,
      method: event.data.data.method,
      status: event.data.data.status,
      hasResponseBody: !!event.data.data.responseBody,
      bodyLength: event.data.data.responseBody ? event.data.data.responseBody.length : 0,
      contentType: event.data.data.contentType
    });
    
    try {
      // Ensure responseBody is never null (empty string is better than null)
      const responseData = {
        ...event.data.data,
        responseBody: event.data.data.responseBody || '',
        timestamp: new Date().toISOString()
      };
      
      // Send message to background script with a response callback
      chrome.runtime.sendMessage({
        action: 'responseCapture',
        data: responseData
      }, (response) => {
        if (chrome.runtime.lastError) {
          // Handle error, common when background script doesn't respond
          console.log('Background script message error (normal if not recording):', 
                     chrome.runtime.lastError.message);
        } else if (response) {
          console.log('Background script acknowledged response capture:', response);
        }
      });
      
      console.log('Successfully sent response data to background script');
    } catch (err) {
      console.error('Error sending message to background script:', err);
    }
  }
  
  if (event.data && event.data.type === 'KEPLOY_EXTENSION_CHECK') {
    console.log('External UI checking for Keploy extension');
    
    // Response with extension presence
    window.postMessage({
      type: 'KEPLOY_EXTENSION_RESPONSE',
      present: true,
    }, '*');
  }
  
  if (event.data && event.data.type === 'KEPLOY_EXECUTE_TESTS') {
    console.log('External UI requesting test execution with job ID:', event.data.jobId);
    
    // Forward job ID to background script for test execution
    chrome.runtime.sendMessage({
      action: 'executeTestsWithJobId',
      jobId: event.data.jobId
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error executing tests:', chrome.runtime.lastError.message);
      }
    });
  }
  
  if (event.data && event.data.type === 'KEPLOY_SAVE_TOKEN') {
    
    // Forward token to background script for saving
    chrome.runtime.sendMessage({
      action: 'keployToken',
      token: event.data.token,
      closeTab: false,
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error saving token:', chrome.runtime.lastError.message);
        window.postMessage({
          type: 'KEPLOY_SAVE_TOKEN_RESPONSE',
          success: false,
          error: chrome.runtime.lastError.message,
        }, '*');
      } else if(response) {
        console.log('Token saved successfully');
        window.postMessage({
          type: 'KEPLOY_SAVE_TOKEN_RESPONSE',
          success: true,
          requestId: event.data.requestId
        }, '*');
      }
    });
  }
});
