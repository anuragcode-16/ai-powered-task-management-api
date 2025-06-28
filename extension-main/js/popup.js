// Get DOM elements
const recordBtn = document.getElementById('recordBtn');
const recordStatus = document.getElementById('recordStatus');
const apiCount = document.getElementById('apiCount');
const completeCount = document.getElementById('completeCount');
const exportSection = document.getElementById('exportSection');
const exportBtn = document.getElementById('exportBtn');
const cleanupBtn = document.getElementById('cleanupBtn');
const resetBtn = document.getElementById('resetBtn');
const debugBtn = document.getElementById('debugBtn');
const copyBtn = document.getElementById('copyBtn');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const generateTestsBtn = document.getElementById('generateTestsBtn');

// Add a new check recording button if it exists in the HTML
const checkRecordingBtn = document.getElementById('checkRecordingBtn');
if (checkRecordingBtn) {
  checkRecordingBtn.addEventListener('click', checkRecordingState);
}

// URL Selector Modal elements
const urlSelectorBtn = document.getElementById('urlSelectorBtn');
const urlSelectorModal = document.getElementById('urlSelectorModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const urlSearchInput = document.getElementById('urlSearchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const urlList = document.getElementById('urlList');
const urlCount = document.getElementById('urlCount');
const selectAllBtn = document.getElementById('selectAllBtn');
const applyUrlFilter = document.getElementById('applyUrlFilter');
const cancelUrlFilter = document.getElementById('cancelUrlFilter');
const baseUrlFilter = document.getElementById('baseUrlFilter');

// Import IndexedDB module
import { IndexedDBStorage } from './db.js';
import { getExportContentAndMeta } from './apiReq.js';

// Track recording state
let isRecording = false;
let capturedAPICalls = 0;
let completeAPICalls = 0;

// URL selector state
let allUrls = [];
let filteredUrls = [];
let selectedUrl = null;

// Function to update the UI based on login status
const updateUI = () => {
  chrome.storage.local.get(['token'], (result) => {
    if (result.token) {
      loginBtn.style.display = 'none';
      logoutBtn.style.display = 'block';
      generateTestsBtn.style.display = 'block';
    } else {
      loginBtn.style.display = 'block';
      logoutBtn.style.display = 'none';
      generateTestsBtn.style.display = 'none';
    }
  });
};

// Login button event listener
loginBtn.addEventListener('click', () => {
  // Send a message to the background script to start the login process
  chrome.runtime.sendMessage({ action: 'initLogin' })
});

// Logout button event listener
logoutBtn.addEventListener('click', () => {
  chrome.storage.local.remove(['token'], () => {
    updateUI();
  });
});

// Initialize UI state from storage
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded - initializing UI');

  // Initial UI update when the popup is opened
  updateUI();

  // Initialize IndexedDB
  try {
    await IndexedDBStorage.initDB();
    console.log('IndexedDB initialized in popup');

    // Update call counts
    await updateCallCounts();
    
    // Auto-prefill URL field based on current website and recorded API calls
    await autoPrefillUrlFilter();
  } catch (error) {
    console.error('Failed to initialize IndexedDB in popup:', error);
  }

  // Check recording state - first try background script
  try {
    chrome.runtime.sendMessage({ action: 'getRecordingState' }, async (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error checking recording state from background:', chrome.runtime.lastError);
        // Fall back to storage
        await checkStorageState();
        return;
      }

      console.log('Background script reports recording state:', response);

      if (response && response.isRecording !== undefined) {
        // Use the background script's state
        if (response.isRecording) {
          startRecordingUI();
        } else {
          stopRecordingUI();
        }

        // Ensure storage matches background state
        chrome.storage.local.set({ isRecording: response.isRecording }, () => {
          console.log('Storage recording state synced with background:', response.isRecording);
        });
      } else {
        // Fall back to storage
        await checkStorageState();
      }
    });
  } catch (err) {
    console.error('Error getting recording state:', err);
    // Fall back to storage
    await checkStorageState();
  }

  // Helper function to check storage state
  async function checkStorageState() {
    chrome.storage.local.get(['isRecording'], (result) => {
      console.log('Retrieved recording state from storage:', result);

      // Update UI based on the storage state
      if (result && result.isRecording === true) {
        startRecordingUI();
      } else {
        stopRecordingUI();
      }
    });
  }
});

// Function to update call counts
async function updateCallCounts() {
  try {
    // Get total API call count
    capturedAPICalls = await IndexedDBStorage.getApiCallCount();
    apiCount.textContent = capturedAPICalls;

    // Get complete API call count
    completeAPICalls = await IndexedDBStorage.getCompleteApiCallCount();
    completeCount.textContent = completeAPICalls;

    // Show export section if we have complete calls
    if (completeAPICalls > 0) {
      exportSection.style.display = 'block';
    } else {
      exportSection.style.display = 'none';
    }

    // Log the counts for debugging
    console.log('Updated API call counts:', {
      total: capturedAPICalls,
      complete: completeAPICalls
    });
  } catch (error) {
    console.error('Error getting API call counts:', error);
  }
}

// Record button click event
recordBtn.addEventListener('click', () => {
  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
});

// Export button click event
exportBtn.addEventListener('click', async () => {
  try {
    const exportFormat = document.getElementById('exportFormat').value;
    const baseUrlFilter = document.getElementById('baseUrlFilter').value.trim();
    const { content, filename, mimeType } = await getExportContentAndMeta(exportFormat, baseUrlFilter);
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    console.log(`Exported as ${filename}`);
  } catch (error) {
    alert(error.message);
  }
});

// Update export button text when format changes
document.getElementById('exportFormat').addEventListener('change', (e) => {
  if (e.target.value === 'curl') {
    exportBtn.textContent = 'Export as cURL';
  } else if (e.target.value === 'curl-snippet') {
    exportBtn.textContent = 'Export as YAML';
  } else {
    exportBtn.textContent = 'Export as JSON';
  }
});

// Cleanup button click event
cleanupBtn.addEventListener('click', async () => {
  try {
    if (confirm('Are you sure you want to remove all incomplete API calls?')) {
      // Purge incomplete API calls
      const count = await IndexedDBStorage.purgeIncompleteApiCalls();

      // Update call counts
      await updateCallCounts();

      // Show success message
      alert(`Successfully removed ${count} incomplete API calls.`);
    }
  } catch (error) {
    console.error('Error purging incomplete API calls:', error);
    alert('Error removing incomplete API calls. Please check console for details.');
  }
});

// Reset button click event
resetBtn.addEventListener('click', async () => {
  try {
    if (confirm('This will delete ALL stored API calls and reset the database. Are you sure?')) {
      // Stop recording if active
      if (isRecording) {
        stopRecording();
      }

      // Clear all API calls from IndexedDB
      await IndexedDBStorage.clearApiCalls();

      // Update call counts
      await updateCallCounts();

      // Show success message
      alert('Database successfully reset. All API calls have been deleted.');
    }
  } catch (error) {
    console.error('Error resetting database:', error);
    alert('Error resetting database. Please check console for details.');
  }
});

// Debug button click event
debugBtn.addEventListener('click', async () => {
  try {
    // First repair any broken records
    const repairedCount = await IndexedDBStorage.repairApiCalls();

    console.log('--- DEBUG INFORMATION ---');
    console.log('Current popup recording state:', isRecording);

    // Check storage state directly
    chrome.storage.local.get(['isRecording'], (storageResult) => {
      console.log('Storage recording state:', storageResult.isRecording);

      // Get all API calls for inspection
      IndexedDBStorage.getAllApiCalls().then(allCalls => {
        console.log('--- API CALLS IN INDEXEDDB ---');
        console.log(`Total calls in database: ${allCalls.length}`);

        // Get active tabs to verify content script injection and background script state
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          if (tabs[0]) {
            try {
              // Check content script status
              chrome.tabs.sendMessage(tabs[0].id, { action: 'debugContentScript' }, (response) => {
                if (chrome.runtime.lastError) {
                  console.log('Content script check error:', chrome.runtime.lastError);
                } else {
                  console.log('Content script status:', response);
                }
              });

              // Check background script status
              chrome.runtime.sendMessage({ action: 'debugBackground' }, (response) => {
                if (chrome.runtime.lastError) {
                  console.log('Background script check error:', chrome.runtime.lastError);
                } else {
                  console.log('Background script status:', response);
                }

                // Process calls statistics after we have all the data
                processCallStats(allCalls, response, storageResult);
              });
            } catch (e) {
              console.error('Error checking script status:', e);
              // Still process call stats if we had an error
              processCallStats(allCalls, null, storageResult);
            }
          } else {
            console.log('No active tab found for debugging');
            processCallStats(allCalls, null, storageResult);
          }
        });
      }).catch(error => {
        console.error('Error getting API calls for debug:', error);
      });
    });
  } catch (error) {
    console.error('Error during debugging:', error);
    alert('Error during debugging. Please check console for details.');
  }

  // Process call statistics
  function processCallStats(allCalls, backgroundStatus, storageResult) {
    // Check the response status for each call
    let complete = 0;
    let incomplete = 0;
    let hasStatusNoBody = 0;
    let hasBodyNoStatus = 0;
    let flaggedComplete = 0;
    let repairedCount = 0;

    allCalls.forEach((call, index) => {
      console.log(`Call #${index + 1}:`, {
        url: call.url,
        method: call.method,
        hasStatusCode: call.statusCode !== null,
        statusCode: call.statusCode,
        hasResponseBody: call.responseBody !== null,
        responseBodyLength: call.responseBody ? String(call.responseBody).length : 0,
        hasResponseFlag: call.hasResponse,
        requestId: call.requestId
      });

      if (call.statusCode !== null && call.responseBody !== null) {
        complete++;
      } else {
        incomplete++;
        if (call.statusCode !== null && call.responseBody === null) {
          hasStatusNoBody++;
        }
        if (call.statusCode === null && call.responseBody !== null) {
          hasBodyNoStatus++;
        }
      }

      if (call.hasResponse) {
        flaggedComplete++;
      }

      if (call.hasResponse !== true && hasStatusNoBody) {
        call.hasResponse = true;
        repairedCount++;
        flaggedComplete++;
      }
    });

    // Update the UI after repair
    updateCallCounts().then(() => {
      // Show export section if we have captured data
      if (completeAPICalls > 0) {
        exportSection.style.display = 'block';
      }
    });

    // Show summary info
    const debugInfo =
      `DEBUG SUMMARY:
      - Total calls: ${allCalls.length}
      - Complete (status+body): ${complete}
      - Incomplete: ${incomplete}
      - Has status but no body: ${hasStatusNoBody}
      - Has body but no status: ${hasBodyNoStatus}
      - Flagged as complete: ${flaggedComplete}
      - Records repaired: ${repairedCount}
      
      Please check the browser console for detailed information about each call.`;

    alert(debugInfo);
  }
});

generateTestsBtn.addEventListener('click', async () => {
  chrome.runtime.sendMessage({ action: 'generateTests', data: {
    baseUrl: document.getElementById('baseUrlFilter').value.trim()
  }});
});

// Listen for API capture updates and state changes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Popup received message:', message);
  switch (message.action) {
  case 'apiCaptured':
    capturedAPICalls = message.count;
    apiCount.textContent = capturedAPICalls;
    // Update complete count when we get a new capture
    updateCallCounts();
    return;
  case 'recordingStateChanged':
    // Update UI if recording state changed from another source
    if (message.isRecording !== isRecording) {
      console.log('Updating UI due to external recording state change:', message.isRecording);
      if (message.isRecording) {
        startRecordingUI();
      } else {
        stopRecordingUI();
      }
    }
    return;
  case 'updatePopup':
    if (message.loggedIn === true) 
      updateUI();
  }
});

// Start recording function
function startRecording() {
  console.log('Start recording requested from popup');

  // Send message to background script
  chrome.runtime.sendMessage({ action: 'startRecording' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error starting recording:', chrome.runtime.lastError);
      alert('Error starting recording: ' + chrome.runtime.lastError.message +
        '\nTry clicking the "Check Recording Status" button for help.');
      return;
    }

    if (response && response.success) {
      console.log('Recording started successfully:', response);

      // Update storage state
      chrome.storage.local.set({ isRecording: true }, () => {
        console.log('Storage recording state set to true from popup');
      });

      // Update UI
      startRecordingUI();
    } else {
      console.error('Failed to start recording:', response);
      alert('Failed to start recording. Try clicking the "Check Recording Status" button for help.');
    }
  });
}

// Stop recording function
function stopRecording() {
  console.log('Stop recording requested from popup');

  // Send message to background script
  chrome.runtime.sendMessage({ action: 'stopRecording' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error stopping recording:', chrome.runtime.lastError);
      return;
    }

    if (response && response.success) {
      console.log('Recording stopped successfully:', response);

      // Update storage state
      chrome.storage.local.set({ isRecording: false }, () => {
        console.log('Storage recording state set to false from popup');
      });

      // Update UI
      stopRecordingUI();
    } else {
      console.error('Failed to stop recording:', response);
    }
  });
}

// Update UI for recording state
function startRecordingUI() {
  isRecording = true;
  recordBtn.textContent = 'Stop Recording';
  recordBtn.classList.remove('record');
  recordBtn.classList.add('stop');
  recordStatus.style.display = 'block';
  console.log('UI updated to recording state');
  
  // Auto-prefill URL filter when recording starts (if not already set)
  autoPrefillUrlFilter().catch(error => {
    console.error('Error auto-prefilling URL on recording start:', error);
  });
}

// Update UI for stopped state
function stopRecordingUI() {
  isRecording = false;
  recordBtn.textContent = 'Record API Calls';
  recordBtn.classList.remove('stop');
  recordBtn.classList.add('record');
  recordStatus.style.display = 'none';
  console.log('UI updated to stopped state');

  // Update call counts when stopping
  updateCallCounts().then(() => {
    // Show export section if we have captured data
    if (completeAPICalls > 0) {
      exportSection.style.display = 'block';
    }
  });
}

// Function to check recording state and fix issues
async function checkRecordingState() {
  console.log('Checking recording state and diagnosing issues...');

  // Object to track state
  const state = {
    storageState: null,
    backgroundState: null,
    uiState: isRecording,
    contentScriptState: null,
    mismatch: false
  };

  try {
    // 1. Check storage state
    chrome.storage.local.get(['isRecording'], async (result) => {
      state.storageState = result.isRecording;
      console.log('Storage recording state:', state.storageState);

      // 2. Check background script state
      try {
        chrome.runtime.sendMessage({ action: 'getRecordingState' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting recording state from background:', chrome.runtime.lastError);
          } else if (response) {
            state.backgroundState = response.isRecording;
            console.log('Background script recording state:', state.backgroundState);
          }

          // 3. Check content script state in the active tab
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
              try {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'getRecordingStatus' }, (response) => {
                  if (chrome.runtime.lastError) {
                    console.error('Error getting recording state from content script:', chrome.runtime.lastError);
                  } else if (response) {
                    state.contentScriptState = response.isRecording;
                    console.log('Content script recording state:', state.contentScriptState);
                  }

                  // Now analyze and fix any mismatches
                  fixRecordingState(state);
                });
              } catch (err) {
                console.error('Error sending message to content script:', err);
                fixRecordingState(state);
              }
            } else {
              console.log('No active tab found to check content script state');
              fixRecordingState(state);
            }
          });
        });
      } catch (err) {
        console.error('Error getting recording state from background script:', err);
        fixRecordingState(state);
      }
    });
  } catch (err) {
    console.error('Error checking recording state:', err);
    alert('Error checking recording state. See console for details.');
  }
}

// Function to fix recording state based on diagnosis
function fixRecordingState(state) {
  console.log('Analyzing recording state:', state);

  // Check for mismatches
  const isBackgroundMismatch = state.backgroundState !== undefined && state.backgroundState !== state.uiState;
  const isStorageMismatch = state.storageState !== undefined && state.storageState !== state.uiState;

  if (isBackgroundMismatch || isStorageMismatch) {
    console.log('Detected recording state mismatch!');

    // Determine the actual recording state (prioritize background script state)
    const actualRecordingState = state.backgroundState !== undefined ? state.backgroundState : state.storageState;

    // Fix the UI and storage
    if (actualRecordingState === true) {
      console.log('Fixing UI to show recording state');
      startRecordingUI();
      // Ensure storage matches
      chrome.storage.local.set({ isRecording: true });
    } else {
      console.log('Fixing UI to show stopped state');
      stopRecordingUI();
      // Ensure storage matches
      chrome.storage.local.set({ isRecording: false });
    }

    alert(`Fixed recording state mismatch. The extension is ${actualRecordingState ? 'recording' : 'not recording'}.`);
  } else {
    // No mismatch, just alert the current state
    alert(`Recording status check: The extension is ${state.uiState ? 'recording' : 'not recording'}.`);
  }

  // Force update of call counts
  updateCallCounts();
}

copyBtn.addEventListener('click', async () => {
  try {
    const exportFormat = document.getElementById('exportFormat').value;
    const baseUrlFilter = document.getElementById('baseUrlFilter').value.trim();
    const { content } = await getExportContentAndMeta(exportFormat, baseUrlFilter);
    await navigator.clipboard.writeText(content);
    alert('Export content copied to clipboard!');
  } catch (error) {
    alert(error.message);
  }
});

// URL Selector Modal Event Listeners
urlSelectorBtn.addEventListener('click', openUrlSelectorModal);
closeModalBtn.addEventListener('click', closeUrlSelectorModal);
cancelUrlFilter.addEventListener('click', closeUrlSelectorModal);

// Close modal when clicking outside
urlSelectorModal.addEventListener('click', (e) => {
  if (e.target === urlSelectorModal) {
    closeUrlSelectorModal();
  }
});

// Search functionality
urlSearchInput.addEventListener('input', handleUrlSearch);
clearSearchBtn.addEventListener('click', clearUrlSearch);

// Select all functionality
selectAllBtn.addEventListener('click', toggleSelectAll);

// Apply filter functionality
applyUrlFilter.addEventListener('click', applySelectedUrlFilter);

// URL Selector Modal Functions
async function openUrlSelectorModal() {
  try {
    // Show modal
    urlSelectorModal.classList.add('show');

    // Clear previous state
    selectedUrl = null;
    urlSearchInput.value = '';
    clearSearchBtn.classList.remove('show');

    // Load URLs
    await loadAvailableUrls();

    // Focus search input
    setTimeout(() => urlSearchInput.focus(), 100);
  } catch (error) {
    console.error('Error opening URL selector modal:', error);
    alert('Error loading URLs. Please try again.');
  }
}

function closeUrlSelectorModal() {
  urlSelectorModal.classList.remove('show');
}

async function loadAvailableUrls() {
  try {
    // Show loading state
    urlList.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <span>Loading URLs...</span>
      </div>
    `;

    // Get all complete API calls
    const apiCalls = await IndexedDBStorage.getCompleteApiCalls();

    if (!apiCalls || apiCalls.length === 0) {
      urlList.innerHTML = `
        <div class="empty-state">
          <span>No URLs found. Start recording API calls to see URLs here.</span>
        </div>
      `;
      urlCount.textContent = '0';
      return;
    }

    // Extract and process URLs
    const urlMap = new Map();

    apiCalls.forEach(call => {
      if (call.url) {
        try {
          const url = new URL(call.url);
          const baseUrl = `${url.protocol}//${url.host}`;
          const fullUrl = call.url;

          // Count occurrences
          if (!urlMap.has(baseUrl)) {
            urlMap.set(baseUrl, {
              baseUrl,
              fullUrls: new Set(),
              count: 0
            });
          }

          const urlData = urlMap.get(baseUrl);
          urlData.fullUrls.add(fullUrl);
          urlData.count++;
        } catch (error) {
          console.warn('Invalid URL encountered:', call.url);
        }
      }
    });

    // Convert to array and sort
    allUrls = Array.from(urlMap.values()).sort((a, b) => {
      // Sort by count (descending) then by base URL
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.baseUrl.localeCompare(b.baseUrl);
    });

    // Initial display
    displayUrls(allUrls);

  } catch (error) {
    console.error('Error loading URLs:', error);
    urlList.innerHTML = `
      <div class="empty-state">
        <span>Error loading URLs. Please try again.</span>
      </div>
    `;
  }
}

function displayUrls(urls) {
  if (!urls || urls.length === 0) {
    urlList.innerHTML = `
      <div class="empty-state">
        <span>No URLs match your search criteria.</span>
      </div>
    `;
    urlCount.textContent = '0';
    return;
  }

  urlCount.textContent = urls.length.toString();

  const urlItems = urls.map(urlData => {
    const { baseUrl, count } = urlData;
    const isSelected = selectedUrl === baseUrl;

    try {
      const url = new URL(baseUrl);
      const domain = url.hostname;
      const protocol = url.protocol;

      return `
        <div class="url-item ${isSelected ? 'selected' : ''}" data-url="${baseUrl}">
          <input type="radio" name="urlSelection" class="url-radio" ${isSelected ? 'checked' : ''} />
          <div class="url-text">
            <span class="url-domain">${domain}</span>
            <span class="url-path">(${protocol})</span>
          </div>
          <span class="url-count">${count}</span>
        </div>
      `;
    } catch (error) {
      return `
        <div class="url-item ${isSelected ? 'selected' : ''}" data-url="${baseUrl}">
          <input type="radio" name="urlSelection" class="url-radio" ${isSelected ? 'checked' : ''} />
          <div class="url-text">
            <span class="url-domain">${baseUrl}</span>
          </div>
          <span class="url-count">${count}</span>
        </div>
      `;
    }
  }).join('');

  urlList.innerHTML = urlItems;

  // Add click handlers
  urlList.querySelectorAll('.url-item').forEach(item => {
    item.addEventListener('click', handleUrlItemClick);
  });

  urlList.querySelectorAll('.url-radio').forEach(radio => {
    radio.addEventListener('click', (e) => {
      e.stopPropagation();
      handleUrlItemClick({ target: radio.closest('.url-item') });
    });
  });

  // Update UI state
  updateSelectAllButton();
  updateApplyButton();
}

function handleUrlItemClick(e) {
  const urlItem = e.target.closest('.url-item');
  if (!urlItem) return;

  const url = urlItem.dataset.url;
  const radio = urlItem.querySelector('.url-radio');

  const previousSelected = urlList.querySelector('.url-item.selected');
  if (previousSelected) {
    previousSelected.classList.remove('selected');
    const previousRadio = previousSelected.querySelector('.url-radio');
    previousRadio.checked = false;
  }

  selectedUrl = url;
  urlItem.classList.add('selected');
  radio.checked = true;

  updateSelectAllButton();
  updateApplyButton();
}

function handleUrlSearch(e) {
  const searchTerm = e.target.value.trim().toLowerCase();

  // Show/hide clear button
  if (searchTerm) {
    clearSearchBtn.classList.add('show');
  } else {
    clearSearchBtn.classList.remove('show');
  }

  // Filter URLs
  if (!searchTerm) {
    filteredUrls = allUrls;
  } else {
    filteredUrls = allUrls.filter(urlData =>
      urlData.baseUrl.toLowerCase().includes(searchTerm)
    );
  }

  displayUrls(filteredUrls);
}

function clearUrlSearch() {
  urlSearchInput.value = '';
  clearSearchBtn.classList.remove('show');
  filteredUrls = allUrls;
  displayUrls(filteredUrls);
  urlSearchInput.focus();
}

function toggleSelectAll() {
  const currentUrls = filteredUrls.length > 0 ? filteredUrls : allUrls;

  if (selectedUrl) {
    // Clear selection
    selectedUrl = null;
    displayUrls(currentUrls);
  }
}

function updateSelectAllButton() {
  const currentUrls = filteredUrls.length > 0 ? filteredUrls : allUrls;
  if (currentUrls.length === 0) {
    selectAllBtn.style.display = 'none';
    return;
  }

  const hasSelection = selectedUrl !== null;
  if (hasSelection) {
    selectAllBtn.textContent = 'Clear';
    selectAllBtn.disabled = false;
    selectAllBtn.style.display = 'block';
  } else {
    selectAllBtn.style.display = 'none';
  }
}

function updateApplyButton() {
  const hasSelection = selectedUrl !== null;
  const hasCustomUrl = urlSearchInput.value.trim() &&
    (urlSearchInput.value.startsWith('http://') || urlSearchInput.value.startsWith('https://'));

  applyUrlFilter.disabled = !hasSelection && !hasCustomUrl;
}

function applySelectedUrlFilter() {
  const customUrl = urlSearchInput.value.trim();

  // Check if there's a custom URL entered
  if (customUrl && (customUrl.startsWith('http://') || customUrl.startsWith('https://'))) {
    baseUrlFilter.value = customUrl;
  } else if (selectedUrl) {
    baseUrlFilter.value = selectedUrl;
  } else {
    alert('Please select a URL or enter a custom URL starting with http:// or https://');
    return;
  }

  closeUrlSelectorModal();
}



// Update search input on input to show apply button state
urlSearchInput.addEventListener('input', () => {
  updateApplyButton();
});





// Auto-prefill URL field based on current website and recorded API calls
async function autoPrefillUrlFilter() {
  try {

    // Get current tab URL to determine the website domain
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });

    if (!tabs || tabs.length === 0) {
      console.log('No active tab found, skipping auto-prefill');
      return;
    }

    const currentTab = tabs[0];
    const currentUrl = currentTab.url;
    
    if (!currentUrl || !currentUrl.startsWith('http')) {
      console.log('Current tab is not a web page, skipping auto-prefill');
      return;
    }

    const currentDomain = new URL(currentUrl).hostname;
    const currentRootDomain = extractRootDomain(currentDomain);
    console.log('Current website domain:', currentDomain);
    console.log('Current website root domain:', currentRootDomain);

    // Get all complete API calls
    const apiCalls = await IndexedDBStorage.getCompleteApiCalls();
    
    if (!apiCalls || apiCalls.length === 0) {
      console.log('No recorded API calls found, skipping auto-prefill');
      return;
    }

    // Group URLs by root domain and analyze them
    const rootDomainMap = new Map();

    apiCalls.forEach(call => {
      if (call.url) {
        try {
          const url = new URL(call.url);
          const domain = url.hostname;
          const rootDomain = extractRootDomain(domain);
          const baseUrl = `${url.protocol}//${url.host}`;
          const pathname = url.pathname;
          
          // For analysis, we'll focus on the root domain and path structure,
          // ignoring query parameters and fragments

          if (!rootDomainMap.has(rootDomain)) {
            rootDomainMap.set(rootDomain, {
              rootDomain,
              domains: new Set(),
              baseUrls: new Set(),
              count: 0,
              allPaths: [],
              fullUrls: new Set()
            });
          }

          const rootDomainData = rootDomainMap.get(rootDomain);
          rootDomainData.domains.add(domain);
          rootDomainData.baseUrls.add(baseUrl);
          rootDomainData.count++;
          rootDomainData.allPaths.push(pathname);
          rootDomainData.fullUrls.add(call.url);

        } catch (error) {
          console.warn('Invalid URL encountered:', call.url);
        }
      }
    });

    // Find the best URL to prefill based on requirements
    let bestUrl = null;

    // Only prefill if there are requests matching the current website's root domain
    const currentRootDomainData = rootDomainMap.get(currentRootDomain);
    if (currentRootDomainData) {
      console.log('Found API calls for current root domain:', currentRootDomain);
      console.log('Total requests for this root domain:', currentRootDomainData.count);
      bestUrl = findBestUrlForRootDomain(currentRootDomainData);
    } else {
      console.log('No API calls found for current root domain:', currentRootDomain);
      console.log('Available root domains:', Array.from(rootDomainMap.keys()));
    }

    // Prefill the URL field if we found a good candidate
    if (bestUrl) {
      console.log('Auto-prefilling URL filter with:', bestUrl);
      console.log('Total root domains analyzed:', rootDomainMap.size);
      console.log('Current root domain match:', currentRootDomainData ? 'Yes' : 'No');
      baseUrlFilter.value = bestUrl;
    } else {
      console.log('No suitable URL found for auto-prefill (no matching root domain)');
      console.log('Total API calls:', apiCalls.length);
      console.log('Total root domains found:', rootDomainMap.size);
    }

  } catch (error) {
    console.error('Error in auto-prefill URL filter:', error);
  }
}

// Helper function to extract root domain (e.g., "xyz.com" from "www.abc.xyz.com")
function extractRootDomain(hostname) {
  if (!hostname) return '';
  
  // Split by dots
  const parts = hostname.split('.');
  
  // If there are less than 2 parts, return as is
  if (parts.length < 2) return hostname;
  
  // For domains like "example.com", "api.example.com", "www.sub.example.com"
  // We want to extract "example.com" (last two parts)
  const rootDomain = parts.slice(-2).join('.');
  console.log(`Extracted root domain "${rootDomain}" from hostname "${hostname}"`);
  return rootDomain;
}

// Helper function to find the best URL for a given root domain
function findBestUrlForRootDomain(rootDomainData) {
  // For root domain, we need to pick the most frequently used base URL
  // and find the common path among all requests
  
  // Get all unique base URLs for this root domain
  const baseUrlsArray = Array.from(rootDomainData.baseUrls);
  
  // If only one base URL, use it with common path
  if (baseUrlsArray.length === 1) {
    const baseUrl = baseUrlsArray[0];
    const commonPath = findLongestCommonPathPrefix(rootDomainData.allPaths);
    
    if (commonPath && commonPath !== '/' && commonPath.length > 1) {
      const cleanPath = commonPath.endsWith('/') && commonPath.length > 1 
        ? commonPath.slice(0, -1) 
        : commonPath;
      return `${baseUrl}${cleanPath}`;
    }
    
    return baseUrl;
  }
  
  // Multiple base URLs - pick the first one (as per requirement: if same requests, pick first)
  // In practice, this handles cases like api.example.com vs www.example.com
  const selectedBaseUrl = baseUrlsArray[0];
  
  // Find common path among ALL requests for this root domain
  const commonPath = findLongestCommonPathPrefix(rootDomainData.allPaths);
  
  if (commonPath && commonPath !== '/' && commonPath.length > 1) {
    const cleanPath = commonPath.endsWith('/') && commonPath.length > 1 
      ? commonPath.slice(0, -1) 
      : commonPath;
    return `${selectedBaseUrl}${cleanPath}`;
  }
  
  return selectedBaseUrl;
}

// Helper function to find the longest common path prefix
function findLongestCommonPathPrefix(paths) {
  if (!paths || paths.length === 0) return '';
  if (paths.length === 1) return paths[0];

  // Split all paths into segments, filtering out empty segments
  const pathSegments = paths.map(path => 
    path.split('/').filter(segment => segment.length > 0)
  ).filter(segments => segments.length > 0); // Remove empty path arrays

  if (pathSegments.length === 0) return '';

  // Find common prefix segments
  let commonSegments = [];
  const minLength = Math.min(...pathSegments.map(segments => segments.length));

  for (let i = 0; i < minLength; i++) {
    const firstSegment = pathSegments[0][i];
    const allMatch = pathSegments.every(segments => segments[i] === firstSegment);
    
    if (allMatch) {
      commonSegments.push(firstSegment);
    } else {
      break;
    }
  }

  // Return the common path (with leading slash)
  return commonSegments.length > 0 ? '/' + commonSegments.join('/') : '';
}

