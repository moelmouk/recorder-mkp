(function() {
  try {
    if (window.__mkpNetworkInterceptorInjected) return;
    window.__mkpNetworkInterceptorInjected = true;

    function safeCloneHeaders(headers) {
      try {
        var out = {};
        if (!headers) return out;
        if (typeof headers.forEach === 'function') {
          headers.forEach(function(v, k) { out[String(k).toLowerCase()] = String(v); });
          return out;
        }
        if (Array.isArray(headers)) {
          headers.forEach(function(pair) {
            if (pair && pair.length >= 2) out[String(pair[0]).toLowerCase()] = String(pair[1]);
          });
          return out;
        }
        if (typeof headers === 'object') {
          Object.keys(headers).forEach(function(k) { out[String(k).toLowerCase()] = String(headers[k]); });
        }
        return out;
      } catch (e) {
        return {};
      }
    }

    function safeBodyToString(body) {
      try {
        if (body == null) return '';
        if (typeof body === 'string') return body;
        if (body instanceof URLSearchParams) return body.toString();
        if (typeof FormData !== 'undefined' && body instanceof FormData) return '[FormData]';
        if (typeof Blob !== 'undefined' && body instanceof Blob) return '[Blob]';
        if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return '[ArrayBuffer]';
        return JSON.stringify(body);
      } catch (e) {
        return '';
      }
    }

    var originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = function(input, init) {
        try {
          var url = (typeof input === 'string') ? input : (input && input.url ? input.url : '');
          var method = (init && init.method) ? String(init.method) : (input && input.method ? String(input.method) : 'GET');
          var headers = safeCloneHeaders((init && init.headers) ? init.headers : (input && input.headers ? input.headers : null));
          var body = safeBodyToString(init && init.body);
          window.postMessage({ source: 'mkp-network-interceptor', kind: 'request', transport: 'fetch', url: url, method: method, headers: headers, body: body, ts: Date.now() }, '*');
        } catch (e) {}
        return originalFetch.apply(this, arguments);
      };
    }

    var XHROpen = XMLHttpRequest.prototype.open;
    var XHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    var XHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
      try {
        this.__mkpMethod = method;
        this.__mkpUrl = url;
        this.__mkpHeaders = {};
      } catch (e) {}
      return XHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
      try {
        if (!this.__mkpHeaders) this.__mkpHeaders = {};
        var k = String(name || '').toLowerCase();
        if (k) this.__mkpHeaders[k] = String(value);
      } catch (e) {}
      return XHRSetRequestHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
      try {
        var method = this.__mkpMethod || 'GET';
        var url = this.__mkpUrl || '';
        var b = safeBodyToString(body);
        var headers = this.__mkpHeaders || {};
        window.postMessage({ source: 'mkp-network-interceptor', kind: 'request', transport: 'xhr', url: url, method: String(method), headers: headers, body: b, ts: Date.now() }, '*');
      } catch (e) {}
      return XHRSend.apply(this, arguments);
    };
  } catch (e) {}
})();
