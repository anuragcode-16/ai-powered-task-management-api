import { IndexedDBStorage } from './db.js';

// Refactor export logic into a function for reuse
async function getExportContentAndMeta(exportFormat, baseUrlFilter) {
  // Get only complete API calls from IndexedDB (those with both request and response)
  let apiCalls = await IndexedDBStorage.getCompleteApiCalls();
  if (baseUrlFilter) {
    apiCalls = apiCalls.filter(call => call.url && call.url.startsWith(baseUrlFilter));
    if (apiCalls.length === 0) {
      throw new Error(`No API calls found with URLs starting with "${baseUrlFilter}". Please check your base URL filter.`);
    }
  }
  if (!apiCalls || apiCalls.length === 0) {
    throw new Error('No complete API calls to export. Make sure you have captured requests with responses.');
  }
  let content, filename, mimeType;
  if (exportFormat === 'curl') {
    content = generateCurlCommands(apiCalls);
    filename = `api_curl_${new Date().toISOString().replace(/[:.]/g, '-')}.sh`;
    mimeType = 'text/plain';
  } else if (exportFormat === 'curl-snippet') {
    content = generateCurlSnippetYaml(apiCalls);
    filename = `api_tests_${new Date().toISOString().replace(/[:.]/g, '-')}.yaml`;
    mimeType = 'text/yaml';
  } else {
    const exportableCalls = apiCalls.map(call => {
      try {
        return {
          requestId: call.requestId,
          url: call.url,
          method: call.method,
          timestamp: call.timestamp,
          requestBody: call.requestBody,
          requestHeaders: call.requestHeaders,
          responseHeaders: call.responseHeaders,
          statusCode: call.statusCode,
          responseBody: call.responseBody
        };
      } catch (callError) {
        return {
          requestId: call.requestId || 'unknown',
          url: call.url || 'unknown',
          error: 'Could not process this API call for export'
        };
      }
    });
    content = JSON.stringify(exportableCalls, null, 2);
    filename = `api_tests_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    mimeType = 'application/json';
  }
  return { content, filename, mimeType };
}



function formatYamlValue(value, indent = '', preferBlock = false) {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }

  let strValue = value;
  if (typeof value === 'object') {
    try {
      strValue = JSON.stringify(value);
    } catch (e) {
      console.warn('Could not JSON.stringify object for YAML, using toString():', value, e);
      strValue = String(value);
    }
  } else {
    strValue = String(value);
  }

  const startsWithSpecial = /^[ \t]*[:{\[\],#&*!|>'"%@`]/;
  const isNumeric = /^\d+(\.\d+)?$/;
  const isBoolean = /^(true|false|null|True|False|Null|TRUE|FALSE|NULL|yes|no|Yes|No|YES|NO|on|off|On|Off|ON|OFF)$/i;

  const isVeryLong = strValue.length > 200;
  const hasComplexContent = strValue.includes(';') && strValue.includes(' ') && strValue.length > 100;
  const isPolicyHeader = strValue.includes('default-src') || strValue.includes('script-src') || strValue.includes('style-src');

  const hasQuotes = strValue.includes('"') || strValue.includes("'");
  const hasSpecialChars = strValue.includes('\\') || strValue.includes('\n') || strValue.includes('\r');

  if (preferBlock && strValue.includes('\n')) {
    const lines = strValue.split('\n');
    let yamlBlock = '|\n';
    lines.forEach(line => {
      yamlBlock += indent + '  ' + line + '\n';
    });
    return yamlBlock.trimEnd();
  } else if (isVeryLong || hasComplexContent || isPolicyHeader) {
    if (isPolicyHeader) {
      return `>\n${indent}  ${strValue}`;
    } else {
      const escapedValue = strValue.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
      return `|\n${indent}  ${escapedValue}`;
    }
  } else if (strValue === '' || startsWithSpecial.test(strValue) || isNumeric.test(strValue) || isBoolean.test(strValue) || hasQuotes || hasSpecialChars) {
    return JSON.stringify(strValue);
  } else {
    return strValue;
  }
}

function generateCurlSnippetYaml(apiCalls) {
  return apiCalls.map((call, index) => {
    try {
      if (!call.url || !call.method) {
        return `# Skipped incomplete API call (missing URL or method)\n`;
      }

      let baseUrl = call.url;
      let urlParams = {};

      try {
        const url = new URL(call.url);
        baseUrl = `${url.protocol}//${url.host}${url.pathname}`;
        url.searchParams.forEach((value, key) => {
          urlParams[key] = value;
        });
      } catch (urlError) {
        console.warn('Error parsing URL, using full URL as baseUrl:', call.url, urlError);
      }

      let requestTimestamp = new Date().toISOString();
      try {
        if (call.timestamp) {
          const date = new Date(call.timestamp);
          if (!isNaN(date.getTime())) {
            requestTimestamp = date.toISOString();
          } else {
            console.warn('Invalid call.timestamp, using current time for request:', call.timestamp);
          }
        }
      } catch (timestampError) {
        console.warn('Error formatting request timestamp, using current time:', timestampError);
      }

      let responseTimestamp = new Date(new Date(requestTimestamp).getTime() + 100).toISOString();
      try {
        const reqDate = new Date(requestTimestamp);
        if (!isNaN(reqDate.getTime())) {
          const respDate = new Date(reqDate.getTime() + 100);
          responseTimestamp = respDate.toISOString();
        } else {
          console.warn('Invalid requestTimestamp for calculating responseTimestamp, using current time + 100ms');
          responseTimestamp = new Date(Date.now() + 100).toISOString();
        }

      } catch (timestampError) {
        console.warn('Error formatting response timestamp:', timestampError);
      }

      const formatHeadersToYaml = (headers, baseIndent) => {
        if (!headers || typeof headers !== 'object') return '';
        let headerYaml = '';
        const headerIndent = baseIndent + '  ';

        const entries = Array.isArray(headers)
          ? headers.map(h => [h.name, h.value])
          : Object.entries(headers);

        entries.forEach(([key, value]) => {
          if (key && value !== undefined && value !== null) {
            const properKey = String(key).split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('-');
            const formattedValue = formatYamlValue(value, headerIndent);

            if (formattedValue.startsWith('|') || formattedValue.startsWith('>')) {
              headerYaml += `${headerIndent}${properKey}: ${formattedValue}\n`;
            } else {
              headerYaml += `${headerIndent}${properKey}: ${formattedValue}\n`;
            }
          }
        });
        return headerYaml;
      };

      let requestBodyStr = '';
      if (call.requestBody !== undefined && call.requestBody !== null) {
        if (typeof call.requestBody === 'string') {
          requestBodyStr = call.requestBody;
        } else {
          try {
            requestBodyStr = JSON.stringify(call.requestBody);
          } catch (bodyError) {
            console.warn('Error stringifying request body:', bodyError);
            requestBodyStr = '[Error: Could not serialize request body]';
          }
        }
      }

      let responseBodyStr = '';
      if (call.responseBody !== undefined && call.responseBody !== null) {
        if (typeof call.responseBody === 'string') {
          responseBodyStr = call.responseBody;
        } else {
          try {
            responseBodyStr = JSON.stringify(call.responseBody);
          } catch (bodyError) {
            console.warn('Error stringifying response body:', bodyError);
            responseBodyStr = '[Error: Could not serialize response body]';
          }
        }
      }

      const getStatusMessage = (statusCode) => {
        const statusMessages = {
          200: 'OK', 201: 'Created', 204: 'No Content',
          400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
          404: 'Not Found', 500: 'Internal Server Error'
        };
        return statusMessages[statusCode] || 'Unknown Status';
      };

      const currentStatusCode = call.statusCode ?? 200;

      let yaml = '';
      yaml += `# Generated by API Recorder Extension\n`;
      yaml += `kind: Http\n`;
      yaml += `name: test-${index + 1}-${call.method?.toLowerCase() || 'call'}-${new Date(requestTimestamp).getTime()}\n`;
      yaml += `spec:\n`;
      yaml += `  metadata: {}\n`;

      yaml += `  req:\n`;
      yaml += `    method: ${call.method}\n`;
      yaml += `    proto_major: 1\n`;
      yaml += `    proto_minor: 1\n`;
      yaml += `    url: ${formatYamlValue(baseUrl, '    ')}\n`;

      if (Object.keys(urlParams).length > 0) {
        yaml += `    url_params:\n`;
        Object.entries(urlParams).forEach(([key, value]) => {
          yaml += `      ${key}: ${formatYamlValue(value, '      ')}\n`;
        });
      }

      const reqHeadersYaml = formatHeadersToYaml(call.requestHeaders, '    ');
      if (reqHeadersYaml) {
        yaml += `    header:\n${reqHeadersYaml}`;
      }

      yaml += `    body: ${formatYamlValue(requestBodyStr, '    ', true)}\n`;
      yaml += `    timestamp: ${requestTimestamp}\n`;

      yaml += `  resp:\n`;
      yaml += `    status_code: ${currentStatusCode}\n`;

      const respHeadersYaml = formatHeadersToYaml(call.responseHeaders, '    ');
      if (respHeadersYaml) {
        yaml += `    header:\n${respHeadersYaml}`;
      }

      yaml += `    body: ${formatYamlValue(responseBodyStr, '    ', true)}\n`;
      yaml += `    status_message: ${formatYamlValue(getStatusMessage(currentStatusCode), '    ')}\n`;
      yaml += `    proto_major: 1\n`;
      yaml += `    proto_minor: 1\n`;
      yaml += `    timestamp: ${responseTimestamp}\n`;

      yaml += `  objects: []\n`;
      yaml += `  assertions:\n`;
      yaml += `    noise:\n`;

      const dynamicHeaders = ['Date', 'Set-Cookie', 'Expires', 'Last-Modified', 'Etag', 'Content-Length', 'X-Request-Id', 'X-Correlation-ID', 'Cf-Ray', 'Server']; // Expanded list
      let noiseHeaderAdded = false;
      const respHeaderKeys = call.responseHeaders ? (Array.isArray(call.responseHeaders) ? call.responseHeaders.map(h => h.name) : Object.keys(call.responseHeaders)) : [];

      dynamicHeaders.forEach(headerName => {
        const foundHeader = respHeaderKeys.find(key => key.toLowerCase() === headerName.toLowerCase());
        if (foundHeader) {
          const keyToUse = String(foundHeader).split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('-');
          yaml += `      header.${keyToUse}: []\n`;
          noiseHeaderAdded = true;
        }
      });

      if (!noiseHeaderAdded) {
        yaml += `      header.Date: []\n`;
      }


      if (call.method === 'POST' || call.method === 'PUT' || call.method === 'PATCH') {
        try {
          const createdTimestamp = Math.floor(new Date(requestTimestamp).getTime() / 1000);
          if (!isNaN(createdTimestamp)) {
            yaml += `  created: ${createdTimestamp}\n`;
          }
        } catch (e) {
          console.warn("Could not generate 'created' timestamp for YAML", e);
        }
      }

      return yaml;

    } catch (error) {
      console.error('Error generating YAML for API call:', call, error);
      const urlDesc = call && call.url ? call.url : (call && call.requestId ? `request ID ${call.requestId}` : 'unknown API call');
      return `# Error generating YAML for ${urlDesc}: ${error.message}\n# Call data: ${JSON.stringify(call).substring(0, 200)}...\n`;
    }
  }).join('\n---\n\n');
}

function generateCurlCommands(apiCalls) {
  return apiCalls.map(call => {
    try {
      // Validate call has required fields
      if (!call.url || !call.method) {
        return `# Skipped incomplete API call\n\n`;
      }

      let cmd = `# ${call.url} (${call.method}) - Status: ${call.statusCode || 'unknown'}\n`;
      cmd += 'curl -X ' + call.method;

      // Add headers - handle both object and null/undefined cases
      if (call.requestHeaders && typeof call.requestHeaders === 'object') {
        // Check if it's an array-like object or plain object
        const entries = Array.isArray(call.requestHeaders)
          ? call.requestHeaders.map(h => [h.name, h.value])
          : Object.entries(call.requestHeaders);

        entries.forEach(([key, value]) => {
          // Skip some headers that curl adds automatically or null values
          if (key && value && !['content-length', 'host'].includes(key.toLowerCase())) {
            try {
              cmd += ` \\\n  -H '${key}: ${String(value).replace(/'/g, "\\'")}'`;
            } catch (headerError) {
              console.warn('Error processing header:', key, headerError);
            }
          }
        });
      }

      // Add request body if it exists
      if (call.requestBody && ['POST', 'PUT', 'PATCH'].includes(call.method)) {
        try {
          let body = call.requestBody;

          // Check if body is already a string
          if (typeof body !== 'string') {
            // Convert object to string
            try {
              body = JSON.stringify(body);
            } catch (e) {
              console.warn('Could not stringify request body:', e);
              body = JSON.stringify({ message: "[Complex object that could not be stringified]" });
            }
          }

          // Make sure we have a string before trying to escape it
          body = String(body).replace(/'/g, "\\'");
          cmd += ` \\\n  -d '${body}'`;
        } catch (bodyError) {
          console.warn('Error processing request body:', bodyError);
          cmd += ` \\\n  # Error processing request body`;
        }
      }

      // Add URL
      cmd += ` \\\n  '${call.url}'`;
      cmd += '\n';

      // Add response body if available
      if (call.responseBody !== undefined && call.responseBody !== null) {
        try {
          let responseBodyStr = '';
          if (typeof call.responseBody === 'string') {
            responseBodyStr = call.responseBody;
          } else {
            responseBodyStr = JSON.stringify(call.responseBody);
          }

          cmd += `\n# Response Body: ${responseBodyStr}\n`;
        } catch (bodyError) {
          console.warn('Error processing response body:', bodyError);
          cmd += '\n# Error: Could not serialize response body\n';
        }
      }

      cmd += '\n';

      return cmd;
    } catch (error) {
      console.error('Error generating curl command for call:', call, error);
      return `# Error generating curl command for ${call.url || 'unknown URL'}\n\n`;
    }
  }).join('');
}

export { getExportContentAndMeta };