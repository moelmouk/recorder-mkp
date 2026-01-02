/**
 * MKP Auto Recorder - Content Script
 * Based on UI Vision RPA code for accurate selector capture
 * With visual recording indicator
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__mkpRecorderInjected) {
    console.log('MKP Recorder already injected, skipping');
    return;
  }
  window.__mkpRecorderInjected = true;

  // ========== CODE FROM UI VISION inspector.js ==========
  
  // Helper functions
  const getTagIndex = (dom) => {
    if (!dom || !dom.parentNode) return 1;
    return Array.from(dom.parentNode.childNodes)
      .filter(item => item.nodeType === 1 && item.tagName === dom.tagName)
      .indexOf(dom) + 1;
  };

  const relativeXPath = (dom) => {
    if (!dom || dom.nodeType !== 1) return '';
    const index = getTagIndex(dom);
    const count = Array.from(dom.parentNode.childNodes)
      .filter(item => item.nodeType === 1 && item.tagName === dom.tagName).length;
    const tag = dom.tagName.toLowerCase();
    return index > 1 ? `${tag}[${index}]` : tag;
  };

  // Main XPath generator (FROM UI VISION)
  const xpath = (dom, cur, list) => {
    const helper = (dom, cur, list) => {
      if (!dom) return null;

      if (!cur) {
        if (dom.nodeType === 3) {
          return helper(dom.parentNode);
        } else {
          return helper(dom, dom, []);
        }
      }

      if (!cur.parentNode) {
        return ['html'].concat(list);
      }

      if (cur.tagName === 'BODY') {
        return ['html', 'body'].concat(list);
      }

      // UI Vision: Use ID without strict validation
      if (cur.id) {
        return [`*[@id="${cur.id}"]`].concat(list);
      }

      return helper(dom, cur.parentNode, [relativeXPath(cur)].concat(list));
    };

    const parts = helper(dom, cur, list);
    if (!parts) return '';
    const prefix = parts[0] === 'html' ? '/' : '//';
    return prefix + parts.join('/');
  };

  // XPath by position (FROM UI VISION)
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

        if (dom === getElementByXPath(locator)) {
          return locator;
        }

        current = current.parentNode;
      }
    } catch (e) {}

    return null;
  };

  // XPath by attributes (FROM UI VISION)
  const xpathAttr = (dom) => {
    const PREFERRED_ATTRIBUTES = ['id', 'name', 'value', 'type', 'action', 'onclick'];

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

          const locator = attributesXPath(
            dom.nodeName.toLowerCase(),
            names,
            attsMap
          );

          if (dom === getElementByXPath(locator)) {
            return locator;
          }
        }
      }
    } catch (e) {}

    return null;
  };

  const attributesXPath = (name, attNames, attributes) => {
    let locator = '//' + name + '[';
    for (let i = 0; i < attNames.length; i++) {
      if (i > 0) locator += ' and ';
      const attName = attNames[i];
      locator += '@' + attName + '=' + attributeValue(attributes[attName]);
    }
    locator += ']';
    return locator;
  };

  const attributeValue = (value) => {
    if (value.indexOf("'") < 0) {
      return "'" + value + "'";
    } else if (value.indexOf('"') < 0) {
      return '"' + value + '"';
    } else {
      let result = 'concat(';
      let didReachEndOfValue = false;
      while (!didReachEndOfValue) {
        const apos = value.indexOf("'");
        const quot = value.indexOf('"');
        if (apos < 0) {
          result += "'" + value + "'";
          didReachEndOfValue = true;
          break;
        } else if (quot < 0) {
          result += '"' + value + '"';
          didReachEndOfValue = true;
          break;
        } else if (quot < apos) {
          const part = value.substring(0, apos);
          result += "'" + part + "'";
          value = value.substring(part.length);
        } else {
          const part = value.substring(0, quot);
          result += '"' + part + '"';
          value = value.substring(part.length);
        }
        result += ',';
      }
      result += ')';
      return result;
    }
  };

  // CSS Selector generator
  const cssSelector = (dom) => {
    if (!dom || dom.nodeType !== 1) return '';
    if (dom.tagName.toLowerCase() === 'body') return 'body';
    if (dom.id) return '#' + CSS.escape(dom.id);

    const tag = dom.tagName.toLowerCase();
    const parent = dom.parentNode;

    if (!parent || parent.nodeType !== 1) return tag;

    const siblings = Array.from(parent.children).filter(el => el.tagName === dom.tagName);

    if (siblings.length === 1) {
      return cssSelector(parent) + ' > ' + tag;
    }

    const index = siblings.indexOf(dom) + 1;
    return cssSelector(parent) + ' > ' + tag + ':nth-of-type(' + index + ')';
  };

  // Get element by XPath
  const getElementByXPath = (xpath) => {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue;
    } catch (e) {
      return null;
    }
  };

  // Main locator generator (FROM UI VISION logic)
  const getLocator = (dom) => {
    if (!dom || dom.nodeType !== 1) {
      return { Target: '', Targets: [] };
    }

    const candidates = [];

    // ID
    if (dom.id) {
      candidates.push(`id=${dom.id}`);
    }

    // Name
    if (dom.getAttribute('name')) {
      candidates.push(`name=${dom.getAttribute('name')}`);
    }

    // Link Text
    if (dom.tagName.toLowerCase() === 'a') {
      const text = dom.innerText.trim();
      if (text) {
        candidates.push(`linkText=${text}`);
      }
    }

    // XPath with ID parent
    try {
      const xp = xpath(dom, null, null);
      if (xp) candidates.push('xpath=' + xp);
    } catch (e) {}

    // XPath by attributes
    try {
      const attrXPath = xpathAttr(dom);
      if (attrXPath) candidates.push('xpath=' + attrXPath);
    } catch (e) {}

    // XPath by position
    try {
      const posXPath = xpathPosition(dom);
      if (posXPath) candidates.push('xpath=' + posXPath);
    } catch (e) {}

    // CSS Selector
    try {
      const css = cssSelector(dom);
      if (css) candidates.push('css=' + css);
    } catch (e) {}

    return {
      Target: candidates[0] || '',
      Targets: candidates
    };
  };

  // ========== RECORDING INDICATOR ==========
  
  let indicatorElement = null;
  let commandCountElement = null;
  let pulseInterval = null;

  function createRecordingIndicator() {
    // Remove existing indicator if any
    removeRecordingIndicator();

    // Create indicator container
    indicatorElement = document.createElement('div');
    indicatorElement.id = 'mkp-recording-indicator';
    indicatorElement.innerHTML = `
      <div class="mkp-indicator-content">
        <div class="mkp-pulse"></div>
        <span class="mkp-text">🔴 Enregistrement en cours</span>
        <span class="mkp-count" id="mkp-command-count">0 commandes</span>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.id = 'mkp-recording-styles';
    style.textContent = `
      #mkp-recording-indicator {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 2147483647;
        background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 25px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 15px rgba(255, 0, 0, 0.4), 0 2px 5px rgba(0, 0, 0, 0.2);
        cursor: default;
        user-select: none;
        animation: mkp-slide-in 0.3s ease-out;
        border: 2px solid rgba(255, 255, 255, 0.3);
      }

      @keyframes mkp-slide-in {
        from {
          transform: translateX(100px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .mkp-indicator-content {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .mkp-pulse {
        width: 12px;
        height: 12px;
        background: white;
        border-radius: 50%;
        animation: mkp-pulse-animation 1.5s ease-in-out infinite;
      }

      @keyframes mkp-pulse-animation {
        0%, 100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.3);
          opacity: 0.7;
        }
      }

      .mkp-text {
        white-space: nowrap;
      }

      .mkp-count {
        background: rgba(255, 255, 255, 0.25);
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
      }

      #mkp-recording-indicator:hover {
        transform: scale(1.02);
      }

      /* Highlight effect when recording action */
      .mkp-action-highlight {
        outline: 3px solid #ff4444 !important;
        outline-offset: 2px !important;
        transition: outline 0.1s ease-in-out !important;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(indicatorElement);

    commandCountElement = document.getElementById('mkp-command-count');

    console.log('MKP Recording indicator shown');
  }

  function removeRecordingIndicator() {
    const indicator = document.getElementById('mkp-recording-indicator');
    const styles = document.getElementById('mkp-recording-styles');
    
    if (indicator) indicator.remove();
    if (styles) styles.remove();
    
    indicatorElement = null;
    commandCountElement = null;

    console.log('MKP Recording indicator hidden');
  }

  function updateCommandCount(count) {
    if (commandCountElement) {
      commandCountElement.textContent = `${count} commande${count !== 1 ? 's' : ''}`;
    }
  }

  // Highlight element briefly when recorded
  function highlightElement(element) {
    if (!element) return;
    
    element.classList.add('mkp-action-highlight');
    setTimeout(() => {
      element.classList.remove('mkp-action-highlight');
    }, 300);
  }

  // ========== RECORDING STATE ==========
  let isRecording = false;
  let recordedCommands = [];

  // ========== EVENT HANDLERS ==========
  const recordClick = (e) => {
    if (!isRecording) return;

    // Ignore clicks on the indicator
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
    chrome.runtime.sendMessage({
      type: 'COMMAND_RECORDED',
      command: command
    });

    // Visual feedback
    highlightElement(target);
    updateCommandCount(recordedCommands.length);

    console.log('MKP Recorded:', command);
  };

  const recordChange = (e) => {
    if (!isRecording) return;

    const target = e.target;
    
    // Ignore indicator
    if (target.closest('#mkp-recording-indicator')) return;

    const tagName = target.tagName.toLowerCase();

    if (tagName === 'input' || tagName === 'textarea') {
      const locator = getLocator(target);
      const value = target.value;

      const command = {
        Command: 'type',
        Target: locator.Target,
        Value: value,
        Targets: locator.Targets,
        Description: ''
      };

      recordedCommands.push(command);
      chrome.runtime.sendMessage({
        type: 'COMMAND_RECORDED',
        command: command
      });

      // Visual feedback
      highlightElement(target);
      updateCommandCount(recordedCommands.length);

      console.log('MKP Recorded:', command);
    } else if (tagName === 'select') {
      const locator = getLocator(target);
      const selectedOption = target.options[target.selectedIndex];
      const value = selectedOption ? selectedOption.text : '';

      const command = {
        Command: 'select',
        Target: locator.Target,
        Value: value,
        Targets: locator.Targets,
        Description: ''
      };

      recordedCommands.push(command);
      chrome.runtime.sendMessage({
        type: 'COMMAND_RECORDED',
        command: command
      });

      // Visual feedback
      highlightElement(target);
      updateCommandCount(recordedCommands.length);
    }
  };

  const recordCheck = (e) => {
    if (!isRecording) return;

    const target = e.target;
    
    // Ignore indicator
    if (target.closest('#mkp-recording-indicator')) return;

    if (target.type === 'checkbox' || target.type === 'radio') {
      const locator = getLocator(target);

      const command = {
        Command: target.checked ? 'check' : 'uncheck',
        Target: locator.Target,
        Value: '',
        Targets: locator.Targets,
        Description: ''
      };

      recordedCommands.push(command);
      chrome.runtime.sendMessage({
        type: 'COMMAND_RECORDED',
        command: command
      });

      // Visual feedback
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
    if (message.type === 'START_RECORDING') {
      startRecording();
      sendResponse({ success: true });
    } else if (message.type === 'STOP_RECORDING') {
      stopRecording();
      sendResponse({ success: true, commands: recordedCommands });
    } else if (message.type === 'SHOW_RECORDING_INDICATOR') {
      createRecordingIndicator();
      // Get current command count from background
      chrome.runtime.sendMessage({ type: 'GET_SCENARIO' }, (response) => {
        if (response && response.scenario) {
          updateCommandCount(response.scenario.Commands.length);
          recordedCommands = response.scenario.Commands.slice();
        }
      });
      sendResponse({ success: true });
    } else if (message.type === 'HIDE_RECORDING_INDICATOR') {
      removeRecordingIndicator();
      sendResponse({ success: true });
    } else if (message.type === 'GET_COMMANDS') {
      sendResponse({ commands: recordedCommands });
    } else if (message.type === 'EXECUTE_COMMAND') {
      executeCommand(message.command).then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep channel open for async response
    }
    return true;
  });

  // ========== CHECK IF SHOULD BE RECORDING ==========
  // On injection, check if we should be recording
  chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' }, (response) => {
    if (response && response.isRecording) {
      console.log('MKP: Restoring recording state');
      startRecording();
      createRecordingIndicator();
      updateCommandCount(response.commandCount || 0);
    }
  });

  // ========== COMMAND EXECUTOR (PLAYER) - Based on UI Vision command_runner.js ==========

  // Check if element is visible (from UI Vision dom_utils.ts)
  const isVisible = (el) => {
    if (el === window.document) return true;
    if (!el) return true;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.opacity === '0' || style.visibility === 'hidden') return false;
    return isVisible(el.parentNode);
  };

  // Get text content (from UI Vision dom_utils.ts)
  const domText = ($dom) => {
    const it = $dom.innerText ? $dom.innerText.trim() : '';
    const tc = $dom.textContent || '';
    const pos = tc.toUpperCase().indexOf(it.toUpperCase());
    return pos === -1 ? it : tc.substr(pos, it.length);
  };

  // Simple glob match (from UI Vision)
  const globMatch = (pattern, text) => {
    if (!pattern.includes('*')) {
      return pattern === text;
    }
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(text);
  };

  // Focus if element is editable (from UI Vision command_runner.js)
  const focusIfEditable = (el) => {
    const tag = el.tagName.toLowerCase();
    const isEditable = (tag === 'input' || tag === 'textarea' || el.contentEditable === 'true');
    if (isEditable && typeof el.focus === 'function') {
      el.focus();
    }
  };

  // Main element finder with fallback support (based on UI Vision getElementByLocatorWithTargetOptions)
  function findElementWithFallback(target, targets, shouldWaitForVisible = false) {
    // Try main target first
    try {
      const el = getElementByLocator(target, shouldWaitForVisible);
      if (el) {
        console.log(`MKP: Element found with primary locator: ${target}`);
        return el;
      }
    } catch (e) {
      console.log(`MKP: Primary locator failed: ${target}`, e.message);
    }

    // Try fallback targets (like UI Vision targetOptions)
    if (targets && targets.length > 0) {
      for (let i = 0; i < targets.length; i++) {
        const altTarget = targets[i];
        if (altTarget === target) continue; // Skip if same as primary
        
        try {
          const el = getElementByLocator(altTarget, shouldWaitForVisible);
          if (el) {
            console.log(`MKP: Element found with fallback locator [${i}]: ${altTarget}`);
            return el;
          }
        } catch (e) {
          console.log(`MKP: Fallback locator [${i}] failed: ${altTarget}`);
        }
      }
    }

    return null;
  }

  // Get element by locator (from UI Vision dom_utils.ts getElementByLocator)
  function getElementByLocator(str, shouldWaitForVisible = false) {
    if (!str) return null;
    
    const i = str.indexOf('=');
    let el = null;

    // Handle pure xpath starting with /
    if (/^\//.test(str)) {
      el = getElementByXPath(str);
    } else if (i === -1) {
      // No '=' found and not xpath - invalid
      throw new Error('Invalid locator: ' + str);
    } else {
      const method = str.substr(0, i);
      const value = str.substr(i + 1);
      const lowerMethod = method.toLowerCase();

      switch (lowerMethod) {
        case 'id':
          el = document.getElementById(value);
          break;

        case 'name':
          el = document.getElementsByName(value)[0];
          break;

        case 'identifier':
          el = document.getElementById(value) || document.getElementsByName(value)[0];
          break;

        case 'link':
        case 'linktext': {
          const links = Array.from(document.getElementsByTagName('a'));
          // Support @POS= syntax like UI Vision
          let match = value.match(/^(.+)@POS=(\d+)$/i);
          let realVal = value;
          let index = 0;

          if (match) {
            realVal = match[1];
            index = parseInt(match[2]) - 1;
          }

          const candidates = links.filter(link => globMatch(realVal, domText(link)));
          el = candidates[index];
          break;
        }

        case 'partiallinktext': {
          const links = Array.from(document.getElementsByTagName('a'));
          let match = value.match(/^(.+)@POS=(\d+)$/i);
          let realVal = value;
          let index = 0;

          if (match) {
            realVal = match[1];
            index = parseInt(match[2]) - 1;
          }

          const pattern = `*${realVal}*`;
          const candidates = links.filter(link => globMatch(pattern, domText(link)));
          el = candidates[index];
          break;
        }

        case 'css':
          el = document.querySelector(value);
          break;

        case 'xpath':
          el = getElementByXPath(value);
          break;

        default:
          throw new Error('Unsupported locator method: ' + method);
      }
    }

    if (!el) {
      throw new Error('Element not found: ' + str);
    }

    if (shouldWaitForVisible && !isVisible(el)) {
      throw new Error('Element found but not visible: ' + str);
    }

    return el;
  }

  // Execute a single command (based on UI Vision command_runner.js run function)
  async function executeCommand(cmd) {
    const command = cmd.Command ? cmd.Command.toLowerCase() : '';
    const target = cmd.Target || '';
    const value = cmd.Value || '';
    const targets = cmd.Targets || [];

    console.log('MKP Executing:', command, target, value);

    switch (command) {
      case 'open': {
        // Navigate to URL
        if (target) {
          window.location.href = target;
        }
        return { success: true };
      }

      case 'click':
      case 'clickandwait': {
        const el = findElementWithFallback(target, targets);
        if (!el) {
          throw new Error(`Element not found: ${target}`);
        }

        // Scroll element into view (like UI Vision)
        try {
          el.scrollIntoView({ block: 'center' });
        } catch (e) {
          console.log('MKP: scrollIntoView failed', e);
        }

        // Dispatch mouse events in sequence (from UI Vision command_runner.js lines 447-458)
        ['mousedown', 'mouseup', 'click'].forEach(eventType => {
          if (eventType === 'click' && typeof el.click === 'function') {
            el.click();
            return;
          }

          el.dispatchEvent(
            new MouseEvent(eventType, {
              view: window,
              bubbles: true,
              cancelable: true
            })
          );
        });

        focusIfEditable(el);
        return { success: true };
      }

      case 'type': {
        const el = findElementWithFallback(target, targets);
        if (!el) {
          throw new Error(`Element not found: ${target}`);
        }

        const tag = el.tagName.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          throw new Error('Element is neither input nor textarea');
        }

        // Scroll and focus (like UI Vision)
        try {
          el.scrollIntoView({ block: 'center' });
        } catch (e) {}

        focusIfEditable(el);

        // Set value and dispatch events (from UI Vision command_runner.js lines 573-584)
        el.value = '';
        el.value = value;
        el.dispatchEvent(new Event('input', { target: el, bubbles: true }));
        el.dispatchEvent(new Event('change', { target: el, bubbles: true }));

        return { success: true };
      }

      case 'select':
      case 'selectandwait': {
        const el = findElementWithFallback(target, targets);
        if (!el) {
          throw new Error(`Element not found: ${target}`);
        }

        const options = Array.from(el.getElementsByTagName('option'));
        const i = value.indexOf('=');
        
        // Parse select value format: label=xxx, value=xxx, index=xxx, id=xxx
        let optionType = 'label';
        let optionValue = value;
        
        if (i !== -1) {
          optionType = value.substring(0, i).toLowerCase();
          optionValue = value.substring(i + 1);
        }

        let option = null;
        switch (optionType) {
          case 'label':
            option = options.find(op => globMatch(optionValue, domText(op).trim()));
            break;
          case 'index':
            option = options[parseInt(optionValue)];
            break;
          case 'id':
            option = options.find(op => op.id === optionValue);
            break;
          case 'value':
            option = options.find(op => op.value === optionValue);
            break;
          default:
            // Try matching by text directly (for simple "optionText" format)
            option = options.find(op => domText(op).trim() === value || op.text === value);
        }

        if (!option) {
          throw new Error(`Cannot find option: ${value}`);
        }

        // Scroll into view
        try {
          el.scrollIntoView({ block: 'center' });
        } catch (e) {}

        // Set selection and dispatch change (from UI Vision command_runner.js)
        el.value = option.value;
        el.dispatchEvent(new Event('change', { target: el, bubbles: true }));

        return { success: true };
      }

      case 'check': {
        const el = findElementWithFallback(target, targets);
        if (!el) {
          throw new Error(`Element not found: ${target}`);
        }

        el.checked = true;
        el.dispatchEvent(new Event('change', { target: el, bubbles: true }));
        return { success: true };
      }

      case 'uncheck': {
        const el = findElementWithFallback(target, targets);
        if (!el) {
          throw new Error(`Element not found: ${target}`);
        }

        el.checked = false;
        el.dispatchEvent(new Event('change', { target: el, bubbles: true }));
        return { success: true };
      }

      case 'mouseover': {
        const el = findElementWithFallback(target, targets);
        if (!el) {
          throw new Error(`Element not found: ${target}`);
        }

        try {
          el.scrollIntoView({ block: 'center' });
        } catch (e) {}

        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        return { success: true };
      }

      case 'sendkeys': {
        const el = findElementWithFallback(target, targets);
        if (!el) {
          throw new Error(`Element not found: ${target}`);
        }

        focusIfEditable(el);
        
        // Send keys one by one
        for (const char of value) {
          el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
        }

        return { success: true };
      }

      case 'waitforvisible':
      case 'waitforelementvisible': {
        // Wait up to 10 seconds for element to be visible
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

        throw new Error(`Timeout waiting for visible element: ${target}`);
      }

      case 'waitforelementpresent': {
        // Wait up to 10 seconds for element to exist
        const maxWait = 10000;
        const interval = 200;
        let waited = 0;

        while (waited < maxWait) {
          try {
            const el = findElementWithFallback(target, targets, false);
            if (el) return { success: true };
          } catch (e) {}
          
          await new Promise(r => setTimeout(r, interval));
          waited += interval;
        }

        throw new Error(`Timeout waiting for element: ${target}`);
      }

      case 'pause': {
        // Pause for specified milliseconds
        const ms = parseInt(target) || parseInt(value) || 1000;
        await new Promise(r => setTimeout(r, ms));
        return { success: true };
      }

      case 'refresh': {
        window.location.reload();
        return { success: true };
      }

      case 'verifytext': {
        const el = findElementWithFallback(target, targets);
        if (!el) {
          throw new Error(`Element not found: ${target}`);
        }

        const text = domText(el);
        if (!globMatch(value, text)) {
          return {
            success: false,
            error: `Text not matched. Expected: "${value}", Actual: "${text}"`
          };
        }
        return { success: true };
      }

      case 'asserttext': {
        const el = findElementWithFallback(target, targets);
        if (!el) {
          throw new Error(`Element not found: ${target}`);
        }

        const text = domText(el);
        if (!globMatch(value, text)) {
          throw new Error(`Text not matched. Expected: "${value}", Actual: "${text}"`);
        }
        return { success: true };
      }

      case 'storetext': {
        const el = findElementWithFallback(target, targets);
        if (!el) {
          throw new Error(`Element not found: ${target}`);
        }

        return {
          success: true,
          vars: { [value]: domText(el) }
        };
      }

      case 'storetitle': {
        return {
          success: true,
          vars: { [value]: document.title }
        };
      }

      case 'editcontent': {
        const el = findElementWithFallback(target, targets);
        if (!el) {
          throw new Error(`Element not found: ${target}`);
        }

        if (el.contentEditable !== 'true') {
          throw new Error('Target is not contenteditable');
        }

        el.focus();
        el.innerHTML = value;
        el.blur();

        return { success: true };
      }

      default:
        throw new Error(`Unsupported command: ${command}`);
    }
  }

  // Legacy findElement function for backward compatibility
  async function findElement(target, targets) {
    return findElementWithFallback(target, targets || []);
  }

  // Legacy findElementByLocator for backward compatibility  
  function findElementByLocator(locator) {
    try {
      return getElementByLocator(locator, false);
    } catch (e) {
      console.error('Error finding element:', e);
      return null;
    }
  }

  console.log('MKP Auto Recorder content script loaded');
})();
