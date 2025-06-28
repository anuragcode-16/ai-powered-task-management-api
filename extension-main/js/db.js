// IndexedDB utility for API call storage
const DB_NAME = 'ApiTestRecorderDB';
const STORE_NAME = 'apiCalls';
const DB_VERSION = 2; // Increased version to trigger onupgradeneeded

// internal state
let db = null;
let dbPromise = null;

// Initialize the database
function initDB() {
  if (db) return Promise.resolve(db);  // already open
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      console.log('IndexedDB connected successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object store for API calls if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Use requestId as the keyPath instead of an auto-generated id
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'requestId' });
        store.createIndex('url', 'url', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('hasResponse', 'hasResponse', { unique: false });
        console.log('Object store created with requestId as key');
      } else {
        // Store exists but we need to make sure indexes exist
        const transaction = event.target.transaction;
        const store = transaction.objectStore(STORE_NAME);

        // Check and create indexes if they don't exist
        if (!store.indexNames.contains('hasResponse')) {
          store.createIndex('hasResponse', 'hasResponse', { unique: false });
          console.log('Added missing hasResponse index to existing store');
        }

        if (!store.indexNames.contains('url')) {
          store.createIndex('url', 'url', { unique: false });
          console.log('Added missing url index to existing store');
        }

        if (!store.indexNames.contains('timestamp')) {
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('Added missing timestamp index to existing store');
        }
      }
    };
  });
  return dbPromise;
}

// Clear all API calls
export async function clearApiCalls() {
  const database = await ready();           // ← waits if necessary
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      console.log('All API calls cleared');
      resolve();
    };

    request.onerror = (event) => {
      console.error('Error clearing API calls:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Save an API call
async function saveApiCall(apiCall) {
  const database = await ready();           // ← waits if necessary

  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    // Add a flag to track if the call has a response
    // Either it already has the flag set or both status and body are present
    apiCall.hasResponse = apiCall.hasResponse ||
      (apiCall.statusCode !== null && apiCall.responseBody !== null);

    // Log the save operation for debugging
    console.log('Saving API call with hasResponse:', apiCall.hasResponse, {
      url: apiCall.url,
      method: apiCall.method,
      hasStatusCode: apiCall.statusCode !== null,
      hasResponseBody: apiCall.responseBody !== null
    });

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Since requestId is now the key, we can use get() directly
    const getRequest = store.get(apiCall.requestId);

    getRequest.onsuccess = (event) => {
      const existingCall = event.target.result;
      let request;

      if (existingCall) {
        // Update existing record preserving any existing data we don't want to overwrite
        const updatedCall = { ...existingCall };

        // Update request data
        if (apiCall.requestBody) updatedCall.requestBody = apiCall.requestBody;
        if (apiCall.requestHeaders) updatedCall.requestHeaders = apiCall.requestHeaders;

        // Update response data
        if (apiCall.responseBody) updatedCall.responseBody = apiCall.responseBody;
        if (apiCall.responseHeaders) updatedCall.responseHeaders = apiCall.responseHeaders;
        if (apiCall.statusCode) updatedCall.statusCode = apiCall.statusCode;

        // Update hasResponse flag
        updatedCall.hasResponse = updatedCall.statusCode !== null && updatedCall.responseBody !== null;

        request = store.put(updatedCall);
      } else {
        // Add new record
        request = store.add(apiCall);
      }

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error('Error saving API call:', event.target.error);
        reject(event.target.error);
      };
    };

    getRequest.onerror = (event) => {
      console.error('Error finding API call:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Get all API calls
async function getAllApiCalls() {
  await ready()
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('Error getting API calls:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Check if an API call is complete (has both status code and response)
function isCompleteApiCall(call) {
  if (!call) return false;

  const hasStatusCode = call.statusCode !== null && call.statusCode !== undefined;
  const hasResponseBody = call.responseBody !== null && call.responseBody !== undefined && call.responseBody !== '';
  const hasResponseFlag = call.hasResponse === true;

  // Log for debugging
  console.debug('Checking API call completeness:', {
    url: call.url,
    method: call.method,
    hasStatusCode,
    hasResponseBody,
    hasResponseFlag,
    isComplete: hasStatusCode
  });

  // A call is complete if it has a status code (response body is optional)
  // This handles cases like 204 No Content, HEAD requests, etc.
  return hasStatusCode && hasResponseBody;
}

// Get only complete API calls (with both request and response)
async function getCompleteApiCalls() {
  await ready()
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      try {
        const allCalls = event.target.result || [];
        console.log(`Checking ${allCalls.length} API calls for completeness`);

        // Filter complete calls manually
        const completeCalls = allCalls.filter(call => {
          try {
            return isCompleteApiCall(call);
          } catch (filterError) {
            console.warn('Error filtering API call:', filterError);
            return false;
          }
        });

        console.log(`Found ${completeCalls.length} complete API calls out of ${allCalls.length} total`);
        resolve(completeCalls);
      } catch (processError) {
        console.error('Error processing API calls:', processError);
        resolve([]);
      }
    };

    request.onerror = (event) => {
      console.error('Error getting API calls:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Get count of complete API calls
async function getCompleteApiCallCount() {
  await ready()
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      try {
        const allCalls = event.target.result || [];
        console.log(`Counting complete API calls from ${allCalls.length} total calls`);

        // Count complete calls manually
        let completeCount = 0;
        allCalls.forEach(call => {
          if (isCompleteApiCall(call)) {
            completeCount++;
          }
        });

        console.log(`Complete API calls: ${completeCount} out of ${allCalls.length}`);
        resolve(completeCount);
      } catch (processError) {
        console.error('Error processing API calls for counting:', processError);
        resolve(0);
      }
    };

    request.onerror = (event) => {
      console.error('Error getting API calls for counting:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Update an API call
async function updateApiCall(apiCall) {
  await ready()
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    // Make sure hasResponse flag is set correctly
    // Either the flag is already true, or both statusCode and responseBody are present
    const hasResponse = apiCall.hasResponse === true ||
      (apiCall.statusCode !== null && apiCall.responseBody !== null);

    // Log current object state
    console.log('Updating API call:', {
      url: apiCall.url,
      method: apiCall.method,
      statusCode: apiCall.statusCode,
      hasResponseBody: apiCall.responseBody !== null,
      currentHasResponseFlag: apiCall.hasResponse,
      newHasResponseValue: hasResponse
    });

    // Make sure the hasResponse flag is set correctly (it might be missing)
    apiCall.hasResponse = hasResponse;

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(apiCall);

    request.onsuccess = (event) => {
      console.log('Successfully updated API call in IndexedDB');
      resolve(apiCall.requestId);
    };

    request.onerror = (event) => {
      console.error('Error updating API call:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Get API call count
async function getApiCallCount() {
  await ready()
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const countRequest = store.count();

    countRequest.onsuccess = () => {
      resolve(countRequest.result);
    };

    countRequest.onerror = (event) => {
      console.error('Error counting API calls:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Purge incomplete API calls (without responses)
async function purgeIncompleteApiCalls() {
  await ready()
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = (event) => {
      try {
        const allCalls = event.target.result || [];
        console.log(`Purging incomplete calls from ${allCalls.length} total calls`);

        const incompleteCalls = allCalls.filter(call => !isCompleteApiCall(call));
        console.log(`Found ${incompleteCalls.length} incomplete calls to delete`);

        let deletedCount = 0;
        const deletePromises = [];

        // Delete each incomplete call
        incompleteCalls.forEach(call => {
          const deletePromise = new Promise((resolveDelete, rejectDelete) => {
            const deleteRequest = store.delete(call.requestId);

            deleteRequest.onsuccess = () => {
              deletedCount++;
              resolveDelete();
            };

            deleteRequest.onerror = (event) => {
              console.error('Error deleting API call:', event.target.error);
              rejectDelete(event.target.error);
            };
          });

          deletePromises.push(deletePromise);
        });

        // Wait for all deletions to complete
        Promise.all(deletePromises)
          .then(() => {
            console.log(`Successfully purged ${deletedCount} incomplete API calls`);
            resolve(deletedCount);
          })
          .catch(error => {
            console.error('Error during purge:', error);
            reject(error);
          });
      } catch (processError) {
        console.error('Error processing calls for purging:', processError);
        reject(processError);
      }
    };

    getAllRequest.onerror = (event) => {
      console.error('Error getting all API calls for purging:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Repair database records (fix missing hasResponse flags)
async function repairApiCalls() {
  await ready()
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      try {
        const allCalls = event.target.result || [];
        console.log(`Repairing ${allCalls.length} API calls`);

        let repairedCount = 0;
        const promises = [];

        allCalls.forEach(call => {
          // Check if the hasResponse flag needs to be fixed
          const hasStatusAndBody = call.statusCode !== null && call.responseBody !== null;
          const currentHasResponse = call.hasResponse === true;

          // Only repair if the flag is missing/wrong when it should be true
          if (!currentHasResponse && hasStatusAndBody) {
            console.log(`Repairing API call: ${call.url} - ${call.method}`);
            call.hasResponse = true;
            repairedCount++;

            const updatePromise = new Promise((resolveUpdate, rejectUpdate) => {
              const updateRequest = store.put(call);
              updateRequest.onsuccess = () => resolveUpdate();
              updateRequest.onerror = (e) => rejectUpdate(e.target.error);
            });

            promises.push(updatePromise);
          }
        });

        // Wait for all updates to complete
        Promise.all(promises)
          .then(() => {
            console.log(`Successfully repaired ${repairedCount} API calls in database`);
            resolve(repairedCount);
          })
          .catch(error => {
            console.error('Error during repair:', error);
            reject(error);
          });
      } catch (processError) {
        console.error('Error processing calls for repair:', processError);
        reject(processError);
      }
    };

    request.onerror = (event) => {
      console.error('Error getting API calls for repair:', event.target.error);
      reject(event.target.error);
    };
  });
}

// helper all other methods can call
async function ready() {
  return db || initDB();
}

// Export module
export const IndexedDBStorage = {
  initDB,
  clearApiCalls,
  saveApiCall,
  getAllApiCalls,
  getCompleteApiCalls,
  getCompleteApiCallCount,
  updateApiCall,
  getApiCallCount,
  purgeIncompleteApiCalls,
  repairApiCalls
};