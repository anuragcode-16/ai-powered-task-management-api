// background.js  – MV3
import { v4 as uuid } from './uuid.js';   // tiny uuid util
import { IndexedDBStorage } from './db.js';
import { getExportContentAndMeta } from './apiReq.js';

let apiCalls = [];
let isRecording = false;
let isGenerating = false;
const idToReqMap = new Map();  // maps X-Api-Recorder-Id → requestId

const KEPLOY_API_URL = 'https://api.keploy.io';
const KEPLOY_APP_URL = 'https://app.keploy.io';
const MAX_TOKENS_LIMIT = 500000; // 500k tokens limit for test generation

// ─────────────────────────────────────────────────────────────────────────────
// helper: notify popup
function broadcastRecordingState(state) {
  chrome.runtime.sendMessage({ action: 'recordingStateChanged', isRecording: state })
    .catch(() => {/* popup not open – ignore */ });
}

// NEW: Helper to notify popup about generation state
function broadcastGeneratingState(state) {
  chrome.runtime.sendMessage({ action: 'generatingStateChanged', isGenerating: state })
    .catch(() => {/* popup not open – ignore */ });
}

// ─────────────────────────────────────────────────────────────────────────────
// one-time extension init
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ isRecording: false, isGenerating: false });
  await IndexedDBStorage.initDB();
});

/**
 * Creates a new popup window for the Keploy login page and injects the
 * content script to listen for the token.
 */
function initiateLogin() {
  const loginUrl = 'https://app.keploy.io/home';

  // Define the properties for the new popup window
  const popupOptions = {
    url: loginUrl,
    type: 'popup',
    width: 500,
    height: 600
  };

  // Create the new window
  chrome.windows.create(popupOptions, (window) => {
    // The 'window' object contains an array of tabs. In a new popup,
    // the first tab (tabs[0]) is the one we want.
    const loginTabId = window.tabs[0].id;

    // Inject the content script into the new tab once it's completely loaded
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === loginTabId && info.status === 'complete') {
        // Remove the listener to avoid injecting the script multiple times
        chrome.tabs.onUpdated.removeListener(listener);

        // Execute the script
        chrome.scripting.executeScript({
          target: { tabId: loginTabId },
          files: ['js/token.js']
        });
      }
    });
  });
}

/**
 * Handles the received token from the content script.
 * @param {object} request The message object received.
 * @param {object} sender The sender of the message.
 * @param {boolean} [closeTab=true] Whether to close the sender's tab after handling the token.
 */
async function handleToken(request, sender, closeTab = true) {
  if (request.token) {
    try {
      // Save the token to the extension's local storage
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ token: request.token }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            console.log('Keploy token saved successfully.');
            resolve();
          }
        });
      });

      // Send message to update the popup
      chrome.runtime.sendMessage({ action: 'updatePopup', loggedIn: true });

      // Close the login tab if specified
      if (sender.tab && sender.tab.id && closeTab) {
        chrome.tabs.remove(sender.tab.id)
          .then(() => console.log("Login tab closed."))
          .catch(err => console.error("Error closing tab:", err));
      }
    } catch (error) {
      console.error('Error saving token:', error);
    }
  } else {
    console.error('Content script sent a message with an empty token.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL message hub (popup ➊ / content-script ➋)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.action) {
    case 'startRecording':
      startRecording().then(() => sendResponse({ success: true, isRecording }));
      return true;                   // async
    case 'stopRecording':
      stopRecording().then(() => sendResponse({ success: true, isRecording }));
      return true;                   // async
    case 'getRecordingState':
      sendResponse({ isRecording }); // sync – no `true`
      break;
    case 'debugBackground':
      sendResponse({
        isRecording,
        apiCallsCount: apiCalls.length,
        apiCallsWithResponses: apiCalls.filter(c => c.hasResponse).length,
        tabId: sender?.tab?.id ?? null
      });
      break;
    case 'responseCapture':          // ➋ body arrived from page
      captureResponse(msg.data).then(ok =>
        sendResponse({ success: ok }));
      return true;
    case 'initLogin':
      initiateLogin();
      return true;
    case 'keployToken':
      handleToken(msg, sender, msg.closeTab).then(ok =>
        sendResponse({ success: ok }));
      return true;
    case 'generateTests':
      handleGenerateTests(msg.data.baseUrl).then(success => {
        sendResponse({ success });
      });
      return true;
    case 'executeTestsWithJobId':
      executeTestsWithJobId(msg.jobId);
      sendResponse({ success: true }); // Immediate response - fire and forget
      break;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW: TEST GENERATION FLOW
// ─────────────────────────────────────────────────────────────────────────────

const keepAlive = (i => state => {
  if (state && !i) {
    console.log('[Generator] Starting keep-alive alarm...');
    if (performance.now() > 20e3) chrome.runtime.getPlatformInfo();
    i = setInterval(chrome.runtime.getPlatformInfo, 20e3);
  } else if (!state && i) {
    clearInterval(i);
    i = 0;
  }
})();

/**
 * Main handler for the entire test generation and execution process.
 * MODIFIED to use chrome.alarms to keep the service worker alive.
 */
async function handleGenerateTests(baseUrl) {
  if (isGenerating) {
   console.warn("Test generation is already in progress.");
   return false;
  }

  isGenerating = true;
  broadcastGeneratingState(true);
  console.log('[Generator] ▶ Starting test generation flow...');

  try {
    keepAlive(true);
    // 1. Get auth token and recorded API calls
    const { token } = await chrome.storage.local.get('token');
    if (!token) {
      throw new Error("User is not logged in. Cannot generate tests.");
    }

    const recordedCalls = await IndexedDBStorage.getCompleteApiCalls();
    if (recordedCalls.length === 0) {
      throw new Error("No completed API calls recorded to use as examples.");
    }

    console.log(`[Generator] Found ${recordedCalls.length} recorded API calls.`);
    
    // 2. Get the cURL examples from the API export
    const { content } = await getExportContentAndMeta('curl', baseUrl);
    console.log(`[Generator] cURL examples obtained.`);

    // 3. Initiate test generation job
    const { genJobId } = await initiateTestGeneration(baseUrl, token, content);
    console.log(`[Generator] Job started with ID: ${genJobId}`);

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.create({
        url: `${KEPLOY_APP_URL}/api-testing/generate/${genJobId}`,
        index: activeTab ? activeTab.index + 1 : undefined,
        active: true // make the new tab focused
      });
    } catch (e) {
      console.error("[Generator] Failed to open results tab, but continuing execution.", e);
    }

   // 5. Connect to the streaming endpoint and execute tests
    await streamAndExecuteTests(genJobId, token);
    console.log('[Generator] ✅ Test generation and execution completed.');
    return true;

  } catch (error) {
    console.error('[Generator] 🛑 Flow failed:', error);
    return false;
  } finally {
    isGenerating = false;
    broadcastGeneratingState(false);
    keepAlive(false); // Stop the keep-alive alarm
    console.log('[Generator] Keep-alive alarm cleared.');
  }
}

/**
 * Estimates the number of tokens in a string (rough approximation: 1 token ≈ 4 characters)
 * @param {string} text - The text to estimate tokens for
 * @returns {number} Estimated number of tokens
 */
function estimateTokens(text) {
  // Rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

/**
 * Limits the examples content to stay under the specified token limit
 * @param {string} examples - The original examples string
 * @param {number} maxTokens - Maximum number of tokens allowed
 * @returns {string} Truncated examples string if needed
 */
function limitExamplesToTokens(examples, maxTokens) {
  const estimatedTokens = estimateTokens(examples);
  
  if (estimatedTokens <= maxTokens) {
    console.log(`[Generator] Examples token count (${estimatedTokens}) is within limit (${maxTokens})`);
    return examples;
  }
  
  console.log(`[Generator] Examples token count (${estimatedTokens}) exceeds limit (${maxTokens}), truncating...`);
  
  // Calculate the approximate character limit based on token limit
  const maxChars = maxTokens * 4; // 4 characters per token approximation
  const truncatedExamples = examples.substring(0, maxChars);
  
  // Try to truncate at a reasonable boundary (end of a curl command)
  const lastCurlIndex = truncatedExamples.lastIndexOf('\ncurl ');
  if (lastCurlIndex > maxChars * 0.8) { // Only use this boundary if it's not too far back
    const boundaryTruncated = truncatedExamples.substring(0, lastCurlIndex);
    console.log(`[Generator] Truncated examples at curl command boundary. New token count: ${estimateTokens(boundaryTruncated)}`);
    return boundaryTruncated;
  }
  
  console.log(`[Generator] Truncated examples at character limit. New token count: ${estimateTokens(truncatedExamples)}`);
  return truncatedExamples;
}

/**
 * Step 1: Sends the initial request to start the test generation job.
 * @param {string} baseUrl - The base URL of the API to generate tests for.
 * @param {string} token - The user's authentication token.
 * @param {string} examples - The cURL examples string.
 * @returns {Promise<object>} The response containing `genJobId` and `appId`.
 */
async function initiateTestGeneration(baseUrl, token, examples) {
  console.log('[Generator] Initiating test generation with API...');

  // Limit examples to stay under token limit
  const limitedExamples = limitExamplesToTokens(examples, MAX_TOKENS_LIMIT);

  const GQL_QUERY = `
    mutation GenerateAPITests(
      $endpoint: String!
      $examples: String!
      $execOnClient: Boolean!
    ) {
      generateAPITests(
        endpoint: $endpoint
        examples: $examples
        execOnClient: $execOnClient
      ) {
        appId
        genJobId
      }
    }
  `;

  const response = await fetch(`${KEPLOY_API_URL}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: GQL_QUERY,
      variables: {
        endpoint: baseUrl,
        examples: limitedExamples,
        execOnClient: true,
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to initiate test generation. Status: ${response.status}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(`GraphQL Error: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return result.data.generateAPITests;
}

/**
 * Step 2, 3, 4: Connects to the streaming API, executes tests, and reports results.
 * @param {string} jobId - The generation job ID.
 * @param {string} token - The user's authentication token.
 */
async function streamAndExecuteTests(jobId, token) {
  console.log(`[Generator] Connecting to stream for job: ${jobId}`);
  const streamUrl = `${KEPLOY_API_URL}/atg/requests/${jobId}`;
  const response = await fetch(streamUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to connect to request stream. Status: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log("[Generator] Stream closed by server.");
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    // The Go server's `json.Encoder` adds a newline, so we can split by it.
    const lines = buffer.split('\n');
    buffer = lines.pop(); // The last part might be incomplete, so save it for the next chunk.

    for (const line of lines) {
      if (line.trim() === '') continue;
      try {
        const testRequest = JSON.parse(line);
        // Execute and report each test. Don't await here to process requests in parallel.
        executeAndReportTest(jobId, token, testRequest);
      } catch (e) {
        console.warn("[Generator] Failed to parse JSON from stream:", e, "Line:", line);
      }
    }
  }
}

/**
 * Executes a single test case received from the stream and posts the response back.
 * @param {string} jobId - The generation job ID.
 * @param {string} token - The user's authentication token.
 * @param {object} testRequest - The request details from the server.
 */
async function executeAndReportTest(jobId, token, testRequest) {
  const { req_id, method, url, body, headers } = testRequest;
  console.log(`[Executor] ▶ Executing request received: ${method} ${url}`);
  let testResponse;

  try {
    const fetchOptions = {
      method: method || 'GET',
      headers: headers || {},
      body: body || undefined,
    };
    const resp = await fetch(url, fetchOptions);

    // Read response body as text
    const bodyText = await resp?.text();

    // Convert Headers object to a plain object
    const hdrs = {};
    resp?.headers?.forEach((value, key) => {
      hdrs[key] = hdrs[key] ? `${hdrs[key]},${value}` : value;
    });

    testResponse = {
      req_id: req_id,
      status: resp.status,
      headers: hdrs,
      body: bodyText,
    };

    console.log(`[Executor] ✔ Request Execution completed with status: ${resp.status}`);
  } catch (error) {
    console.error(`[Executor] 🛑 Request Execution failed for ${url}:`, error);
    testResponse = {
      req_id: req_id,
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      error: `Execution failed: ${error.message}`,
    };
  }

  // Report the result back to the server
  const reportUrl = `${KEPLOY_API_URL}/atg/response/${jobId}/${req_id}`;
  try {
    const report = await fetch(reportUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(testResponse)
    });
    if (!report.ok) {
      console.error(`[Reporter] Failed to report result for ReqID ${req_id}. Status: ${report.status}`);
    } else {
      console.log(`[Reporter] ✅ Result for ${req_id} reported successfully.`);
    }
  } catch (e) {
    console.error(`[Reporter] 🛑 Error reporting result for ${req_id}:`, e);
  }
}

/**
 * Executes tests using a job ID provided by external UI.
 * This function directly calls streamAndExecuteTests without generating tests.
 * @param {string} jobId - The job ID from external UI
 * @returns {Promise<boolean>} True if execution started successfully, false otherwise.
 */
async function executeTestsWithJobId(jobId) {
  if (!jobId) {
    console.error('[ExternalExecution] No job ID provided');
    return false;
  }

  try {
    // Check if user is logged in
    const { token } = await chrome.storage.local.get('token');
    if (!token) {
      console.error('[ExternalExecution] User is not logged in. Cannot execute tests.');
      return false;
    }

    console.log(`[ExternalExecution] ▶ Starting test execution for job ID: ${jobId}`);
    
    // Execute tests using the provided job ID
    await streamAndExecuteTests(jobId, token);

    console.log('[ExternalExecution] ✅ Test execution completed successfully');
    return true;

  } catch (error) {
    console.error('[ExternalExecution] 🛑 Test execution failed:', error);
    return false;
  } finally {
    isGenerating = false;
    broadcastGeneratingState(false);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECORD / STOP
async function startRecording() {
  console.log('[Recorder] ▶ start');
  apiCalls = [];
  isRecording = true;
  await chrome.storage.local.set({ isRecording });
  broadcastRecordingState(isRecording);
  await IndexedDBStorage.clearApiCalls();
  addWebRequestListeners();
  await injectInterceptorIntoActiveTab();
}

async function stopRecording() {
  console.log('[Recorder] ■ stop');
  isRecording = false;
  await chrome.storage.local.set({ isRecording });
  broadcastRecordingState(isRecording);
  removeWebRequestListeners();
  await removeInterceptorFromActiveTab();
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB-REQUEST hooks (only **xmlhttprequest** & **fetch**)
const filter = { urls: ['<all_urls>'], types: ['xmlhttprequest', 'other'] };

function addWebRequestListeners() {
  try {
    chrome.webRequest.onBeforeRequest.addListener(
      onBeforeReq, filter, ['requestBody', 'extraHeaders']);
    chrome.webRequest.onBeforeSendHeaders.addListener(
      onBeforeHdr, filter, ['requestHeaders', 'extraHeaders']);
    chrome.webRequest.onCompleted.addListener(
      onCompleted, filter, ['responseHeaders', 'extraHeaders']);
  } catch (e) {
    console.error('[Recorder] failed to add webRequest listeners:', e);
  }
}


function removeWebRequestListeners() {
  chrome.webRequest.onBeforeRequest.removeListener(onBeforeReq);
  chrome.webRequest.onBeforeSendHeaders.removeListener(onBeforeHdr);
  chrome.webRequest.onCompleted.removeListener(onCompleted);
}

// BEFORE-REQUEST  – create skeleton entry + remember custom id
function onBeforeReq(d) {
  if (!isRecording || skip(d)) return;
  console.debug('[Recorder] onBeforeReq:', d);
  let entry = apiCalls.find(c => c.requestId === d.requestId);
  if (!entry) {
    entry = {
      requestId: d.requestId,
      customId: null,
      url: d.url,
      method: d.method,
      timestamp: new Date().toISOString(),
      requestBody: parseRequestBody(d.requestBody),
      requestHeaders: {},
      responseHeaders: {},
      statusCode: null,
      responseBody: null,
      hasResponse: false
    };
    apiCalls.push(entry);
    // Persist the initial entry to DB
    IndexedDBStorage.saveApiCall(entry).then(updateCounter);
  }
}

// BEFORE-HEADERS  – store req headers
function onBeforeHdr(d) {
  if (!isRecording || skip(d)) return;
  const entry = apiCalls.find(c => c.requestId === d.requestId);
  if (!entry) return; // Should not happen if onBeforeReq fired correctly

  console.debug('[Recorder] onBeforeHdr:', d)
  const customId = (d.requestHeaders ?? [])
    .find(h => h.name.toLowerCase() === 'x-api-recorder-id')?.value;

  if (customId) {
    entry.customId = customId;
    idToReqMap.set(customId, d.requestId);
    console.debug(`[Recorder] Linked recorderId ${customId} to requestId ${d.requestId}`);
  }

  entry.requestHeaders = toObj(d.requestHeaders);
  IndexedDBStorage.updateApiCall(entry);
}

// COMPLETED (no body yet)
function onCompleted(d) {
  if (!isRecording || skip(d)) return;
  const entry = apiCalls.find(c => c.requestId === d.requestId);
  if (!entry) return;

  const contentTypeHeader = d.responseHeaders.find(h => 
    h.name.toLowerCase() === 'content-type'
  );

  const contentType = contentTypeHeader ? contentTypeHeader.value : '';

  console.debug('[Recorder] onCompleted:', d.method + " " + d.url, d)
  if (!contentType.includes('application/json')) {
    console.log('Skipping non-JSON response in onCompleted:', d)
    return;
  }

  Object.assign(entry, {
    responseHeaders: toObj(d.responseHeaders),
    statusCode: d.statusCode,
    hasResponse: true
  });
  IndexedDBStorage.updateApiCall(entry).then(updateCounter);
}

// ─────────────────────────────────────────────────────────────────────────────
// BODY CAPTURE from page ➋
async function captureResponse(r) {
  if (!isRecording) return false;

  console.log('[Recorder] captureResponse:', r)

  // Only save responses with application/json content type
  if (!r.contentType || !r.contentType.includes('application/json')) {
    console.log('Skipping non-JSON response in captureResponse:', r)
    return false;
  }

  // ① use custom header id → requestId mapping
  let entry = null;
  if (r.recorderId && idToReqMap.has(r.recorderId)) {
    const reqId = idToReqMap.get(r.recorderId);
    entry = apiCalls.find(c => c.requestId === reqId);
  }

  // ② fallback same url+method and still missing body
  if (!entry) {
    entry = apiCalls.find(c => c.url === r.url &&
      c.method === r.method &&
      !c.hasResponse);
  }

  if (entry) {
    Object.assign(entry, {
      responseBody: r.responseBody,
      statusCode: r.status,
      hasResponse: true
    });
    if (r.contentType) { 
      entry.responseHeaders['content-type'] = r.contentType;
    }
    await IndexedDBStorage.updateApiCall(entry);
    updateCounter();
    return true;
  }

  // ③ body came first – make standalone record
  const apiCall = {
    requestId: `late-${uuid()}`,
    customId: r.recorderId ?? null,
    url: r.url,
    method: r.method,
    timestamp: new Date().toISOString(),
    requestBody: null,
    requestHeaders: {},
    responseHeaders: r.contentType ? { 'content-type': r.contentType } : {},
    statusCode: r.status,
    responseBody: r.responseBody,
    hasResponse: true
  };
  apiCalls.push(apiCall);
  await IndexedDBStorage.saveApiCall(apiCall);
  updateCounter();
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTIL
const skipExt = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'css', 'js', 'woff', 'woff2', 'ttf', 'eot', 'ico'];
function skip(d) {
  try {
    const u = new URL(d.url);
    if (skipExt.includes(u.pathname.split('.').pop().toLowerCase())) return true;
  } catch (_) { }
  return false;
}
const toObj = (arr = []) => Object.fromEntries(arr.map(h => [h.name.toLowerCase(), h.value]));
function parseRequestBody(rb) {
  if (!rb?.raw?.length) return null;
  try { return JSON.parse(new TextDecoder().decode(rb.raw[0].bytes)); }
  catch { return '[binary or non-JSON]'; }
}
function updateCounter() {
  chrome.runtime.sendMessage({
    action: 'apiCaptured',
    count: apiCalls.filter(c => c.hasResponse).length
  })
    .catch(() => { });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT-SCRIPT injection helpers
async function injectInterceptorIntoActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.url.startsWith('chrome://')) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: contentInterceptor
  });
}

async function removeInterceptorFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: () => window.__apiRecorderRestore?.()
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN-WORLD injector  (runs inside the page)
function contentInterceptor() {
  if (window.__apiRecorderRestore) return;   // already patched

  const uuid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 8);

  // helper that tags each outgoing req with an id header
  function addIdHeader(init, id) {
    if (init instanceof Request) {
      init.headers.set('X-Api-Recorder-Id', id);
      return init;
    }
    const opts = init || {};
    const h = new Headers(opts.headers || {});
    h.set('X-Api-Recorder-Id', id);
    return { ...opts, headers: h };
  }

  // PATCH fetch
  const _fetch = window.fetch;
  window.fetch = async function (input, init) {
    const id = uuid();
    const method = (input instanceof Request ? input.method : init?.method) || 'GET';
    const url = input instanceof Request ? input.url : input;
    console.log("fetch uuid", id)

    const resp = await _fetch(input, addIdHeader(init, id));
    resp.clone().text().then(body => {
      window.postMessage({
        type: 'API_RECORDER_RESPONSE',
        data: {
          recorderId: id,
          url: resp.url, method,
          status: resp.status,
          contentType: resp.headers.get('content-type') ?? null,
          responseBody: body
        }
      }, '*');
    }).catch(() => { });
    return resp;
  };

  // PATCH XHR
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u, ...rest) {
    this.__recId = uuid();
    this.__recUrl = u;
    this.__recMeth = m.toUpperCase();
    return _open.call(this, m, u, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (this.__recId) this.setRequestHeader('X-Api-Recorder-Id', this.__recId);
    console.log("xhr uuid", this)
    this.addEventListener('load', function () {
      window.postMessage({
        type: 'API_RECORDER_RESPONSE',
        data: {
          recorderId: this.__recId,
          url: this.responseURL,
          method: this.__recMeth,
          status: this.status,
          contentType: this.getResponseHeader('content-type'),
          responseBody: this.responseText
        }
      }, '*');
    });
    return _send.call(this, body);
  };

  // expose restore hook
  window.__apiRecorderRestore = () => {
    window.fetch = _fetch;
    XMLHttpRequest.prototype.open = _open;
    XMLHttpRequest.prototype.send = _send;
    delete window.__apiRecorderRestore;
  };

  console.log('[Recorder] interceptors active');
}
