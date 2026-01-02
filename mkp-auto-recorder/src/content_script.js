/**
 * MKP Auto Recorder - Content Script v2.0
 * With real timing capture and modern indicator
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__mkpRecorderInjected) {
    console.log('MKP Recorder already injected, skipping');
    return;
  }
  window.__mkpRecorderInjected = true;

  // ========== XPATH HELPERS (FROM UI VISION) ==========
  
  const getTagIndex = (dom) => {
    if (!dom || !dom.parentNode) return 1;
    return Array.from(dom.parentNode.childNodes)
      .filter(item => item.nodeType === 1 && item.tagName === dom.tagName)
      .indexOf(dom) + 1;
  };

  const relativeXPath = (dom) => {
    if (!dom || dom.nodeType !== 1) return '';
    const index = getTagIndex(dom);
    const tag = dom.tagName.toLowerCase();
    return index > 1 ? `${tag}[${index}]` : tag;
  };

  const xpath = (dom, cur, list) => {
    const helper = (dom, cur, list) => {
      if (!dom) return null;
      if (!cur) {
        if (dom.nodeType === 3) return helper(dom.parentNode);
        return helper(dom, dom, []);
      }
      if (!cur.parentNode) return ['html'].concat(list);
      if (cur.tagName === 'BODY') return ['html', 'body'].concat(list);
      if (cur.id) return [`*[@id="${cur.id}"]`].concat(list);
      return helper(dom, cur.parentNode, [relativeXPath(cur)].concat(list));
    };
    const parts = helper(dom, cur, list);
    if (!parts) return '';
    const prefix = parts[0] === 'html' ? '/' : '//';
    return prefix + parts.join('/');
  };

  const xpathPosition = (dom) => {
    let path = '';
    let current = dom;
    try {
      while (current !== null) {
        let currentPath;
        if (current.parentNode != null) {
          currentPath = '/' + relativeXPath(current);
        } else if (current.tagName === 'BODY') {
          currentPath = 'html/body';
        } else {
          currentPath = '/' + current.nodeName.toLowerCase();
        }
        path = currentPath + path;
        const locator = '/' + path;
        if (dom === getElementByXPath(locator)) return locator;
        current = current.parentNode;
      }
    } catch (e) {}
    return null;
  };

  const xpathAttr = (dom) => {
    const PREFERRED_ATTRIBUTES = ['id', 'name', 'value', 'type', 'action', 'onclick', 'data-testid', 'aria-label'];
    try {
      if (!dom.attributes) return null;
      const attsMap = {};
      for (let i = 0; i < dom.attributes.length; i++) {
        const att = dom.attributes[i];
        attsMap[att.name] = att.value;
      }
      const names = [];
      for (let i = 0; i < PREFERRED_ATTRIBUTES.length; i++) {
        const name = PREFERRED_ATTRIBUTES[i];
        if (attsMap[name] != null) {
          names.push(name);
          const locator = attributesXPath(dom.nodeName.toLowerCase(), names, attsMap);
          if (dom === getElementByXPath(locator)) return locator;
        }
      }
    } catch (e) {}
    return null;
  };

  const attributesXPath = (name, attNames, attributes) => {
    let locator = '//' + name + '[';
    for (let i = 0; i < attNames.length; i++) {
      if (i > 0) locator += ' and ';
      locator += '@' + attNames[i] + '=' + attributeValue(attributes[attNames[i]]);
    }
    return locator + ']';
  };

  const attributeValue = (value) => {
    if (value.indexOf("'") < 0) return "'" + value + "'";
    if (value.indexOf('"') < 0) return '"' + value + '"';
    let result = 'concat(';
    let done = false;
    while (!done) {
      const apos = value.indexOf("'");
      const quot = value.indexOf('"');
      if (apos < 0) { result += "'" + value + "'"; done = true; }
      else if (quot < 0) { result += '"' + value + '"'; done = true; }
      else if (quot < apos) {
        result += "'" + value.substring(0, apos) + "',";
        value = value.substring(apos);
      } else {
        result += '"' + value.substring(0, quot) + '",';
        value = value.substring(quot);
      }
    }
    return result + ')';
  };

  const cssSelector = (dom) => {
    if (!dom || dom.nodeType !== 1) return '';
    if (dom.tagName.toLowerCase() === 'body') return 'body';
    if (dom.id) return '#' + CSS.escape(dom.id);
    const tag = dom.tagName.toLowerCase();
    const parent = dom.parentNode;
    if (!parent || parent.nodeType !== 1) return tag;
    const siblings = Array.from(parent.children).filter(el => el.tagName === dom.tagName);
    if (siblings.length === 1) return cssSelector(parent) + ' > ' + tag;
    const index = siblings.indexOf(dom) + 1;
    return cssSelector(parent) + ' > ' + tag + ':nth-of-type(' + index + ')';
  };

  const getElementByXPath = (xpath) => {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue;
    } catch (e) { return null; }
  };

  const getLocator = (dom) => {
    if (!dom || dom.nodeType !== 1) return { Target: '', Targets: [] };
    const candidates = [];
    
    if (dom.id) candidates.push(`id=${dom.id}`);
    if (dom.getAttribute('name')) candidates.push(`name=${dom.getAttribute('name')}`);
    if (dom.getAttribute('data-testid')) candidates.push(`css=[data-testid="${dom.getAttribute('data-testid')}"]`);
    if (dom.tagName.toLowerCase() === 'a') {
      const text = dom.innerText.trim();
      if (text && text.length < 50) candidates.push(`linkText=${text}`);
    }
    
    try { const xp = xpath(dom, null, null); if (xp) candidates.push('xpath=' + xp); } catch (e) {}
    try { const attrXPath = xpathAttr(dom); if (attrXPath) candidates.push('xpath=' + attrXPath); } catch (e) {}
    try { const posXPath = xpathPosition(dom); if (posXPath) candidates.push('xpath=' + posXPath); } catch (e) {}
    try { const css = cssSelector(dom); if (css) candidates.push('css=' + css); } catch (e) {}

    return { Target: candidates[0] || '', Targets: candidates };
  };

  // ========== RECORDING INDICATOR ==========
  
  let indicatorElement = null;

  function createRecordingIndicator() {
    removeRecordingIndicator();

    indicatorElement = document.createElement('div');
    indicatorElement.id = 'mkp-recording-indicator';
    indicatorElement.innerHTML = `
      <div class="mkp-indicator-inner">
        <div class="mkp-pulse"></div>
        <span class="mkp-text">Enregistrement</span>
        <span class="mkp-count" id="mkp-cmd-count">0</span>
      </div>
    `;

    const style = document.createElement('style');
    style.id = 'mkp-recording-styles';
    style.textContent = `
      #mkp-recording-indicator {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: mkp-slide-in 0.3s ease-out;
      }
      @keyframes mkp-slide-in {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .mkp-indicator-inner {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 50px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      .mkp-pulse {
        width: 10px;
        height: 10px;
        background: #ef4444;
        border-radius: 50%;
        animation: mkp-pulse 1.5s ease-in-out infinite;
      }
      @keyframes mkp-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.3); opacity: 0.6; }
      }
      .mkp-text {
        font-size: 13px;
        font-weight: 600;
        color: #1e293b;
      }
      .mkp-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        height: 24px;
        padding: 0 8px;
        background: #6366f1;
        color: white;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
      }
      .mkp-highlight {
        outline: 2px solid #6366f1 !important;
        outline-offset: 2px !important;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(indicatorElement);
    console.log('MKP Recording indicator shown');
  }

  function removeRecordingIndicator() {
    const indicator = document.getElementById('mkp-recording-indicator');
    const styles = document.getElementById('mkp-recording-styles');
    if (indicator) indicator.remove();
    if (styles) styles.remove();
    indicatorElement = null;
  }

  function updateCommandCount(count) {
    const el = document.getElementById('mkp-cmd-count');
    if (el) el.textContent = count;
  }

  function highlightElement(element) {
    if (!element) return;
    element.classList.add('mkp-highlight');
    setTimeout(() => element.classList.remove('mkp-highlight'), 300);
  }

  // ========== RECORDING STATE ==========
  
  let isRecording = false;
  let recordedCommands = [];

  // ========== EVENT HANDLERS ==========

  const recordClick = (e) => {
    if (!isRecording) return;
    if (e.target.closest('#mkp-recording-indicator')) return;

    const target = e.target;
    const locator = getLocator(target);

    const command = {
      Command: 'click',
      Target: locator.Target,
      Value: '',
      Targets: locator.Targets,
      Description: ''
    };

    recordedCommands.push(command);
    chrome.runtime.sendMessage({ type: 'COMMAND_RECORDED', command: command });
    
    highlightElement(target);
    updateCommandCount(recordedCommands.length);
    console.log('MKP Recorded:', command);
  };

  const recordChange = (e) => {
    if (!isRecording) return;
    if (e.target.closest('#mkp-recording-indicator')) return;

    const target = e.target;
    const tagName = target.tagName.toLowerCase();

    if (tagName === 'input' || tagName === 'textarea') {
      const locator = getLocator(target);
      const command = {
        Command: 'type',
        Target: locator.Target,
        Value: target.value,
        Targets: locator.Targets,
        Description: ''
      };

      recordedCommands.push(command);
      chrome.runtime.sendMessage({ type: 'COMMAND_RECORDED', command: command });
      
      highlightElement(target);
      updateCommandCount(recordedCommands.length);
    } else if (tagName === 'select') {
      const locator = getLocator(target);
      const selectedOption = target.options[target.selectedIndex];
      const command = {
        Command: 'select',
        Target: locator.Target,
        Value: selectedOption ? selectedOption.text : '',
        Targets: locator.Targets,
        Description: ''
      };

      recordedCommands.push(command);
      chrome.runtime.sendMessage({ type: 'COMMAND_RECORDED', command: command });
      
      highlightElement(target);
      updateCommandCount(recordedCommands.length);
    }
  };

  // ========== START/STOP RECORDING ==========

  const startRecording = () => {
    isRecording = true;
    recordedCommands = [];
    document.addEventListener('click', recordClick, true);
    document.addEventListener('change', recordChange, true);
    console.log('MKP Recording started');
  };

  const stopRecording = () => {
    isRecording = false;
    document.removeEventListener('click', recordClick, true);
    document.removeEventListener('change', recordChange, true);
    console.log('MKP Recording stopped');
  };

  // ========== MESSAGE LISTENER ==========

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'START_RECORDING':
        startRecording();
        sendResponse({ success: true });
        break;
      case 'STOP_RECORDING':
        stopRecording();
        sendResponse({ success: true, commands: recordedCommands });
        break;
      case 'SHOW_RECORDING_INDICATOR':
        createRecordingIndicator();
        chrome.runtime.sendMessage({ type: 'GET_SCENARIO' }, (response) => {
          if (response && response.scenario) {
            updateCommandCount(response.scenario.Commands.length);
            recordedCommands = response.scenario.Commands.slice();
          }
        });
        sendResponse({ success: true });
        break;
      case 'HIDE_RECORDING_INDICATOR':
        removeRecordingIndicator();
        sendResponse({ success: true });
        break;
      case 'GET_COMMANDS':
        sendResponse({ commands: recordedCommands });
        break;
      case 'EXECUTE_COMMAND':
        executeCommand(message.command).then(result => {
          sendResponse(result);
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true;
    }
    return true;
  });

  // Check if should be recording on injection
  chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' }, (response) => {
    if (response && response.isRecording) {
      console.log('MKP: Restoring recording state');
      startRecording();
      createRecordingIndicator();
      updateCommandCount(response.commandCount || 0);
    }
  });

  // ========== COMMAND EXECUTOR ==========

  const isVisible = (el) => {
    if (el === window.document) return true;
    if (!el) return true;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.opacity === '0' || style.visibility === 'hidden') return false;
    return isVisible(el.parentNode);
  };

  const domText = ($dom) => {
    const it = $dom.innerText ? $dom.innerText.trim() : '';
    const tc = $dom.textContent || '';
    const pos = tc.toUpperCase().indexOf(it.toUpperCase());
    return pos === -1 ? it : tc.substr(pos, it.length);
  };

  const globMatch = (pattern, text) => {
    if (!pattern.includes('*')) return pattern === text;
    const regexPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`, 'i').test(text);
  };

  const focusIfEditable = (el) => {
    const tag = el.tagName.toLowerCase();
    if ((tag === 'input' || tag === 'textarea' || el.contentEditable === 'true') && typeof el.focus === 'function') {
      el.focus();
    }
  };

  function findElementWithFallback(target, targets, shouldWaitForVisible = false) {
    try {
      const el = getElementByLocator(target, shouldWaitForVisible);
      if (el) return el;
    } catch (e) {}

    if (targets && targets.length > 0) {
      for (const altTarget of targets) {
        if (altTarget === target) continue;
        try {
          const el = getElementByLocator(altTarget, shouldWaitForVisible);
          if (el) return el;
        } catch (e) {}
      }
    }
    return null;
  }

  function getElementByLocator(str, shouldWaitForVisible = false) {
    if (!str) return null;
    const i = str.indexOf('=');
    let el = null;

    if (/^\//.test(str)) {
      el = getElementByXPath(str);
    } else if (i === -1) {
      throw new Error('Invalid locator: ' + str);
    } else {
      const method = str.substr(0, i).toLowerCase();
      const value = str.substr(i + 1);

      switch (method) {
        case 'id': el = document.getElementById(value); break;
        case 'name': el = document.getElementsByName(value)[0]; break;
        case 'identifier': el = document.getElementById(value) || document.getElementsByName(value)[0]; break;
        case 'link':
        case 'linktext': {
          const links = Array.from(document.getElementsByTagName('a'));
          el = links.find(link => globMatch(value, domText(link)));
          break;
        }
        case 'css': el = document.querySelector(value); break;
        case 'xpath': el = getElementByXPath(value); break;
        default: throw new Error('Unsupported locator: ' + method);
      }
    }

    if (!el) throw new Error('Element not found: ' + str);
    if (shouldWaitForVisible && !isVisible(el)) throw new Error('Element not visible: ' + str);
    return el;
  }

  async function executeCommand(cmd) {
    const command = cmd.Command ? cmd.Command.toLowerCase() : '';
    const target = cmd.Target || '';
    const value = cmd.Value || '';
    const targets = cmd.Targets || [];

    console.log('MKP Executing:', command, target, value);

    switch (command) {
      case 'open':
        if (target) window.location.href = target;
        return { success: true };

      case 'click':
      case 'clickandwait': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Element not found: ${target}`);
        
        try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
        
        ['mousedown', 'mouseup', 'click'].forEach(eventType => {
          if (eventType === 'click' && typeof el.click === 'function') {
            el.click();
            return;
          }
          el.dispatchEvent(new MouseEvent(eventType, { view: window, bubbles: true, cancelable: true }));
        });
        
        focusIfEditable(el);
        return { success: true };
      }

      case 'type': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Element not found: ${target}`);
        
        try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
        focusIfEditable(el);
        
        el.value = '';
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      }

      case 'select':
      case 'selectandwait': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Element not found: ${target}`);
        
        const options = Array.from(el.getElementsByTagName('option'));
        let option = options.find(op => domText(op).trim() === value || op.text === value || op.value === value);
        
        if (!option) throw new Error(`Cannot find option: ${value}`);
        
        el.value = option.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      }

      case 'check': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Element not found: ${target}`);
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      }

      case 'uncheck': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Element not found: ${target}`);
        el.checked = false;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      }

      case 'waitforvisible':
      case 'waitforelementvisible': {
        const maxWait = 10000;
        const interval = 200;
        let waited = 0;
        while (waited < maxWait) {
          try {
            const el = findElementWithFallback(target, targets, true);
            if (el) return { success: true };
          } catch (e) {}
          await new Promise(r => setTimeout(r, interval));
          waited += interval;
        }
        throw new Error(`Timeout waiting for: ${target}`);
      }

      case 'pause': {
        const ms = parseInt(target) || parseInt(value) || 1000;
        await new Promise(r => setTimeout(r, ms));
        return { success: true };
      }

      case 'refresh':
        window.location.reload();
        return { success: true };

      default:
        throw new Error(`Unsupported command: ${command}`);
    }
  }

  console.log('MKP Auto Recorder content script v2.0 loaded');
})();
