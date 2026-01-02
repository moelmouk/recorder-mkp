/**
 * MKP Auto Recorder - Content Script
 * Based on UI Vision RPA code for accurate selector capture
 */

(function() {
  'use strict';

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

  // ========== RECORDING STATE ==========
  let isRecording = false;
  let recordedCommands = [];
  let processedElements = new Set(); // Track elements we've already processed in this interaction
  let lastCommandKey = ''; // Unique key for last command to prevent duplicates
  let inputValues = new Map(); // Track input values to only record final value

  // ========== HELPER FUNCTIONS ==========
  
  // Generate unique key for a command
  const getCommandKey = (cmd, target) => {
    return `${cmd}|${target}`;
  };

  // Check if element is a text input
  const isTextInput = (el) => {
    if (!el) return false;
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'textarea') return true;
    if (tagName === 'input') {
      const type = (el.type || 'text').toLowerCase();
      return ['text', 'email', 'password', 'search', 'tel', 'url', 'number', ''].includes(type);
    }
    return false;
  };

  // Check if element is checkbox or radio
  const isCheckableInput = (el) => {
    if (!el) return false;
    if (el.tagName.toLowerCase() !== 'input') return false;
    const type = (el.type || '').toLowerCase();
    return type === 'checkbox' || type === 'radio';
  };

  // Find the actual interactive element (for labels, spans, etc.)
  const findInteractiveElement = (el) => {
    if (!el) return null;
    
    // If it's already an input, return it
    if (el.tagName.toLowerCase() === 'input' || 
        el.tagName.toLowerCase() === 'select' || 
        el.tagName.toLowerCase() === 'textarea') {
      return el;
    }
    
    // Check if it's a label
    if (el.tagName.toLowerCase() === 'label') {
      const forId = el.getAttribute('for');
      if (forId) {
        return document.getElementById(forId);
      }
      // Check for nested input
      return el.querySelector('input, select, textarea');
    }
    
    // Check parent label
    const parentLabel = el.closest('label');
    if (parentLabel) {
      const forId = parentLabel.getAttribute('for');
      if (forId) {
        return document.getElementById(forId);
      }
      return parentLabel.querySelector('input, select, textarea');
    }
    
    return null;
  };

  // Record command with strict deduplication
  const recordCommand = (command) => {
    const key = getCommandKey(command.Command, command.Target);
    
    // Strict duplicate check
    if (key === lastCommandKey) {
      console.log('MKP Skipped duplicate:', command.Command);
      return false;
    }
    
    lastCommandKey = key;
    recordedCommands.push(command);
    
    chrome.runtime.sendMessage({
      type: 'COMMAND_RECORDED',
      command: command
    });

    console.log('MKP Recorded:', command.Command, command.Target);
    return true;
  };

  // ========== EVENT HANDLERS ==========
  
  // Handle clicks
  const handleClick = (e) => {
    if (!isRecording) return;

    const target = e.target;
    
    // Find the actual interactive element
    const interactiveEl = findInteractiveElement(target);
    
    // Skip if clicking on a text input (we record 'type' instead)
    if (isTextInput(target) || (interactiveEl && isTextInput(interactiveEl))) {
      return;
    }
    
    // Skip if clicking on checkbox/radio (we record via 'change' event)
    if (isCheckableInput(target) || (interactiveEl && isCheckableInput(interactiveEl))) {
      return;
    }
    
    // For clicks on labels of checkable inputs, skip (change event will handle)
    if (interactiveEl && isCheckableInput(interactiveEl)) {
      return;
    }

    // Record the click on the actual clicked element
    const locator = getLocator(target);
    if (!locator.Target) return;

    recordCommand({
      Command: 'click',
      Target: locator.Target,
      Value: '',
      Targets: locator.Targets,
      Description: ''
    });
  };

  // Handle input changes (for text fields) - debounced via blur
  const handleInput = (e) => {
    if (!isRecording) return;
    
    const target = e.target;
    if (!isTextInput(target)) return;
    
    // Just track the value, we'll record on blur
    const locator = getLocator(target);
    inputValues.set(locator.Target, {
      element: target,
      locator: locator,
      value: target.value
    });
  };

  // Handle blur - finalize text input
  const handleBlur = (e) => {
    if (!isRecording) return;
    
    const target = e.target;
    if (!isTextInput(target)) return;
    
    const locator = getLocator(target);
    const tracked = inputValues.get(locator.Target);
    
    if (tracked && tracked.value) {
      // Check if we already have a type command for this target
      const existingIndex = recordedCommands.findIndex(
        cmd => cmd.Command === 'type' && cmd.Target === locator.Target
      );
      
      if (existingIndex >= 0) {
        // Update existing command
        recordedCommands[existingIndex].Value = tracked.value;
        console.log('MKP Updated type:', locator.Target);
      } else {
        // Add new command
        recordCommand({
          Command: 'type',
          Target: locator.Target,
          Value: tracked.value,
          Targets: locator.Targets,
          Description: ''
        });
      }
      
      inputValues.delete(locator.Target);
    }
  };

  // Handle change events (checkboxes, radios, selects)
  const handleChange = (e) => {
    if (!isRecording) return;

    const target = e.target;
    const tagName = target.tagName.toLowerCase();

    // Skip text inputs (handled by blur)
    if (isTextInput(target)) return;

    // Handle select
    if (tagName === 'select') {
      const locator = getLocator(target);
      const selectedOption = target.options[target.selectedIndex];
      if (!selectedOption) return;

      recordCommand({
        Command: 'select',
        Target: locator.Target,
        Value: `label=${selectedOption.text}`,
        Targets: locator.Targets,
        Description: ''
      });
      return;
    }

    // Handle checkbox
    if (tagName === 'input' && target.type === 'checkbox') {
      const locator = getLocator(target);
      recordCommand({
        Command: target.checked ? 'check' : 'uncheck',
        Target: locator.Target,
        Value: '',
        Targets: locator.Targets,
        Description: ''
      });
      return;
    }

    // Handle radio
    if (tagName === 'input' && target.type === 'radio') {
      const locator = getLocator(target);
      recordCommand({
        Command: 'click',
        Target: locator.Target,
        Value: '',
        Targets: locator.Targets,
        Description: ''
      });
      return;
    }
  };

  // ========== START/STOP RECORDING ==========
  const startRecording = () => {
    isRecording = true;
    recordedCommands = [];
    lastCommandKey = '';
    inputValues.clear();

    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('blur', handleBlur, true);
    document.addEventListener('change', handleChange, true);

    console.log('MKP Recording started');
  };

  const stopRecording = () => {
    // Finalize any pending inputs
    inputValues.forEach((tracked, targetKey) => {
      if (tracked.value) {
        const existingIndex = recordedCommands.findIndex(
          cmd => cmd.Command === 'type' && cmd.Target === targetKey
        );
        
        if (existingIndex >= 0) {
          recordedCommands[existingIndex].Value = tracked.value;
        } else {
          recordedCommands.push({
            Command: 'type',
            Target: targetKey,
            Value: tracked.value,
            Targets: tracked.locator.Targets,
            Description: ''
          });
        }
      }
    });
    inputValues.clear();

    isRecording = false;

    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('input', handleInput, true);
    document.removeEventListener('blur', handleBlur, true);
    document.removeEventListener('change', handleChange, true);

    console.log('MKP Recording stopped, commands:', recordedCommands.length);
  };

  // ========== MESSAGE LISTENER ==========
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_RECORDING') {
      startRecording();
      sendResponse({ success: true });
    } else if (message.type === 'STOP_RECORDING') {
      stopRecording();
      sendResponse({ success: true, commands: recordedCommands });
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

  // Main element finder with fallback support
  function findElementWithFallback(target, targets, shouldWaitForVisible = false) {
    // Try main target first
    try {
      const el = getElementByLocator(target, shouldWaitForVisible);
      if (el) {
        console.log(`MKP: Element found with primary locator`);
        return el;
      }
    } catch (e) {
      console.log(`MKP: Primary locator failed:`, e.message);
    }

    // Try fallback targets
    if (targets && targets.length > 0) {
      for (let i = 0; i < targets.length; i++) {
        const altTarget = targets[i];
        if (altTarget === target) continue;
        
        try {
          const el = getElementByLocator(altTarget, shouldWaitForVisible);
          if (el) {
            console.log(`MKP: Element found with fallback [${i}]`);
            return el;
          }
        } catch (e) {}
      }
    }

    return null;
  }

  // Get element by locator (from UI Vision dom_utils.ts)
  function getElementByLocator(str, shouldWaitForVisible = false) {
    if (!str) return null;
    
    const i = str.indexOf('=');
    let el = null;

    if (/^\//.test(str)) {
      el = getElementByXPath(str);
    } else if (i === -1) {
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

  // Execute a single command
  async function executeCommand(cmd) {
    const command = cmd.Command ? cmd.Command.toLowerCase() : '';
    const target = cmd.Target || '';
    const value = cmd.Value || '';
    const targets = cmd.Targets || [];

    console.log('MKP Executing:', command, target);

    switch (command) {
      case 'open': {
        if (target) {
          window.location.href = target;
        }
        return { success: true };
      }

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

        const tag = el.tagName.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          throw new Error('Element is neither input nor textarea');
        }

        try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
        focusIfEditable(el);

        el.value = '';
        el.value = value;
        el.dispatchEvent(new Event('input', { target: el, bubbles: true }));
        el.dispatchEvent(new Event('change', { target: el, bubbles: true }));

        return { success: true };
      }

      case 'select':
      case 'selectandwait': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Element not found: ${target}`);

        const options = Array.from(el.getElementsByTagName('option'));
        const i = value.indexOf('=');
        
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
            option = options.find(op => domText(op).trim() === value || op.text === value);
        }

        if (!option) throw new Error(`Cannot find option: ${value}`);

        try { el.scrollIntoView({ block: 'center' }); } catch (e) {}

        el.value = option.value;
        el.dispatchEvent(new Event('change', { target: el, bubbles: true }));

        return { success: true };
      }

      case 'check': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Element not found: ${target}`);
        el.checked = true;
        el.dispatchEvent(new Event('change', { target: el, bubbles: true }));
        return { success: true };
      }

      case 'uncheck': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Element not found: ${target}`);
        el.checked = false;
        el.dispatchEvent(new Event('change', { target: el, bubbles: true }));
        return { success: true };
      }

      case 'mouseover': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Element not found: ${target}`);
        try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        return { success: true };
      }

      case 'sendkeys': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Element not found: ${target}`);
        focusIfEditable(el);
        for (const char of value) {
          el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
        }
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
        throw new Error(`Timeout waiting for visible element: ${target}`);
      }

      case 'waitforelementpresent': {
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
        if (!el) throw new Error(`Element not found: ${target}`);
        const text = domText(el);
        if (!globMatch(value, text)) {
          return { success: false, error: `Text not matched. Expected: "${value}", Actual: "${text}"` };
        }
        return { success: true };
      }

      case 'asserttext': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Element not found: ${target}`);
        const text = domText(el);
        if (!globMatch(value, text)) {
          throw new Error(`Text not matched. Expected: "${value}", Actual: "${text}"`);
        }
        return { success: true };
      }

      case 'storetext': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Element not found: ${target}`);
        return { success: true, vars: { [value]: domText(el) } };
      }

      case 'storetitle': {
        return { success: true, vars: { [value]: document.title } };
      }

      case 'editcontent': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Element not found: ${target}`);
        if (el.contentEditable !== 'true') throw new Error('Target is not contenteditable');
        el.focus();
        el.innerHTML = value;
        el.blur();
        return { success: true };
      }

      default:
        throw new Error(`Unsupported command: ${command}`);
    }
  }

  console.log('MKP Auto Recorder content script loaded');
})();
