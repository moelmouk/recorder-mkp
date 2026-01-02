/**
 * MKP Auto Recorder - Content Script
 * Fixed: proper deduplication with time-based filtering
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__MKP_RECORDER_LOADED__) {
    console.log('MKP: Already loaded, skipping');
    return;
  }
  window.__MKP_RECORDER_LOADED__ = true;

  // ========== XPATH UTILITIES ==========
  
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

  const xpath = (dom) => {
    const parts = [];
    let current = dom;

    while (current && current.nodeType === 1) {
      if (current.tagName === 'BODY') {
        parts.unshift('body');
        parts.unshift('html');
        break;
      }
      
      // Use ID if it's valid (not containing weird characters/code)
      if (current.id && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(current.id)) {
        parts.unshift(`*[@id="${current.id}"]`);
        break;
      }
      
      parts.unshift(relativeXPath(current));
      current = current.parentNode;
    }

    if (parts.length === 0) return '';
    const prefix = parts[0] === 'html' ? '/' : '//';
    return prefix + parts.join('/');
  };

  const getElementByXPath = (xpath) => {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue;
    } catch (e) {
      return null;
    }
  };

  // CSS Selector (simplified, more reliable)
  const cssSelector = (dom) => {
    if (!dom || dom.nodeType !== 1) return '';
    if (dom.tagName.toLowerCase() === 'body') return 'body';
    
    // Use ID only if valid
    if (dom.id && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(dom.id)) {
      return '#' + dom.id;
    }

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

  // Get locator for element
  const getLocator = (dom) => {
    if (!dom || dom.nodeType !== 1) {
      return { Target: '', Targets: [] };
    }

    const candidates = [];

    // Valid ID only
    if (dom.id && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(dom.id)) {
      candidates.push(`id=${dom.id}`);
    }

    // Name attribute
    if (dom.getAttribute('name')) {
      candidates.push(`name=${dom.getAttribute('name')}`);
    }

    // XPath
    try {
      const xp = xpath(dom);
      if (xp) candidates.push('xpath=' + xp);
    } catch (e) {}

    // CSS
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
  let lastClickTime = 0;
  let lastClickTarget = '';
  let lastInputTarget = '';
  let inputTimer = null;

  const CLICK_DEBOUNCE = 500; // 500ms between same clicks
  const INPUT_DEBOUNCE = 800; // Wait 800ms after typing stops

  // ========== HELPERS ==========
  
  const isTextInput = (el) => {
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const type = (el.type || 'text').toLowerCase();
      return ['text', 'email', 'password', 'search', 'tel', 'url', 'number', ''].includes(type);
    }
    return false;
  };

  const isCheckable = (el) => {
    if (!el || el.tagName.toLowerCase() !== 'input') return false;
    const type = (el.type || '').toLowerCase();
    return type === 'checkbox' || type === 'radio';
  };

  const sendCommand = (command) => {
    console.log('MKP Recording:', command.Command, command.Target.substring(0, 50));
    chrome.runtime.sendMessage({ type: 'COMMAND_RECORDED', command: command });
  };

  // ========== EVENT HANDLERS ==========
  
  const handleClick = (e) => {
    if (!isRecording) return;

    const target = e.target;
    
    // Skip text inputs
    if (isTextInput(target)) return;
    
    // Skip checkable inputs (handled by change)
    if (isCheckable(target)) return;

    // Skip clicks on labels for checkable inputs
    const label = target.closest('label');
    if (label) {
      const forId = label.getAttribute('for');
      if (forId) {
        const input = document.getElementById(forId);
        if (input && (isTextInput(input) || isCheckable(input))) return;
      }
      const nestedInput = label.querySelector('input');
      if (nestedInput && (isTextInput(nestedInput) || isCheckable(nestedInput))) return;
    }

    const locator = getLocator(target);
    if (!locator.Target) return;

    // STRICT DEDUPLICATION: same target within debounce time
    const now = Date.now();
    if (locator.Target === lastClickTarget && (now - lastClickTime) < CLICK_DEBOUNCE) {
      console.log('MKP Skip duplicate click');
      return;
    }

    lastClickTime = now;
    lastClickTarget = locator.Target;

    sendCommand({
      Command: 'click',
      Target: locator.Target,
      Value: '',
      Targets: locator.Targets,
      Description: ''
    });
  };

  const handleInput = (e) => {
    if (!isRecording) return;
    
    const target = e.target;
    if (!isTextInput(target)) return;

    const locator = getLocator(target);
    if (!locator.Target) return;

    // Clear previous timer for this element
    if (inputTimer) clearTimeout(inputTimer);
    
    lastInputTarget = locator.Target;

    // Debounce: record after user stops typing
    inputTimer = setTimeout(() => {
      if (!isRecording) return;
      
      const value = target.value;
      if (!value) return;

      sendCommand({
        Command: 'type',
        Target: locator.Target,
        Value: value,
        Targets: locator.Targets,
        Description: ''
      });
    }, INPUT_DEBOUNCE);
  };

  const handleBlur = (e) => {
    if (!isRecording) return;
    
    const target = e.target;
    if (!isTextInput(target)) return;

    // Cancel debounce timer and record immediately
    if (inputTimer) {
      clearTimeout(inputTimer);
      inputTimer = null;
    }

    const value = target.value;
    if (!value) return;

    const locator = getLocator(target);
    if (!locator.Target) return;

    // Only record if this is the element we were tracking
    if (locator.Target !== lastInputTarget) return;
    lastInputTarget = '';

    sendCommand({
      Command: 'type',
      Target: locator.Target,
      Value: value,
      Targets: locator.Targets,
      Description: ''
    });
  };

  const handleChange = (e) => {
    if (!isRecording) return;

    const target = e.target;
    const tag = target.tagName.toLowerCase();

    // Skip text inputs (handled by blur)
    if (isTextInput(target)) return;

    const locator = getLocator(target);
    if (!locator.Target) return;

    // Handle select
    if (tag === 'select') {
      const option = target.options[target.selectedIndex];
      if (!option) return;

      sendCommand({
        Command: 'select',
        Target: locator.Target,
        Value: `label=${option.text}`,
        Targets: locator.Targets,
        Description: ''
      });
      return;
    }

    // Handle checkbox
    if (tag === 'input' && target.type === 'checkbox') {
      sendCommand({
        Command: target.checked ? 'check' : 'uncheck',
        Target: locator.Target,
        Value: '',
        Targets: locator.Targets,
        Description: ''
      });
      return;
    }

    // Handle radio
    if (tag === 'input' && target.type === 'radio') {
      sendCommand({
        Command: 'click',
        Target: locator.Target,
        Value: '',
        Targets: locator.Targets,
        Description: ''
      });
      return;
    }
  };

  // ========== RECORDING CONTROL ==========
  
  const startRecording = () => {
    console.log('MKP: Starting recording');
    isRecording = true;
    lastClickTime = 0;
    lastClickTarget = '';
    lastInputTarget = '';
    if (inputTimer) clearTimeout(inputTimer);

    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('blur', handleBlur, true);
    document.addEventListener('change', handleChange, true);
  };

  const stopRecording = () => {
    console.log('MKP: Stopping recording');
    isRecording = false;
    
    if (inputTimer) {
      clearTimeout(inputTimer);
      inputTimer = null;
    }

    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('input', handleInput, true);
    document.removeEventListener('blur', handleBlur, true);
    document.removeEventListener('change', handleChange, true);
  };

  // ========== MESSAGE LISTENER ==========
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_RECORDING') {
      startRecording();
      sendResponse({ success: true });
    } else if (message.type === 'STOP_RECORDING') {
      stopRecording();
      sendResponse({ success: true });
    } else if (message.type === 'EXECUTE_COMMAND') {
      executeCommand(message.command).then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;
    }
    return true;
  });

  // ========== COMMAND EXECUTOR ==========

  const isVisible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  };

  const domText = (el) => el.innerText ? el.innerText.trim() : (el.textContent || '').trim();

  const globMatch = (pattern, text) => {
    if (!pattern.includes('*')) return pattern === text;
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
    return regex.test(text);
  };

  function findElement(target, targets) {
    // Try main target
    try {
      const el = getElementByLocator(target);
      if (el) return el;
    } catch (e) {}

    // Try fallbacks
    for (const alt of (targets || [])) {
      if (alt === target) continue;
      try {
        const el = getElementByLocator(alt);
        if (el) return el;
      } catch (e) {}
    }
    return null;
  }

  function getElementByLocator(str) {
    if (!str) return null;
    
    const i = str.indexOf('=');
    
    if (/^\//.test(str)) {
      return getElementByXPath(str);
    }
    
    if (i === -1) return null;
    
    const method = str.substring(0, i).toLowerCase();
    const value = str.substring(i + 1);

    switch (method) {
      case 'id':
        return document.getElementById(value);
      case 'name':
        return document.getElementsByName(value)[0];
      case 'css':
        return document.querySelector(value);
      case 'xpath':
        return getElementByXPath(value);
      case 'link':
      case 'linktext':
        const links = Array.from(document.getElementsByTagName('a'));
        return links.find(a => domText(a) === value);
      default:
        return null;
    }
  }

  async function executeCommand(cmd) {
    const command = (cmd.Command || '').toLowerCase();
    const target = cmd.Target || '';
    const value = cmd.Value || '';
    const targets = cmd.Targets || [];

    console.log('MKP Execute:', command, target.substring(0, 50));

    switch (command) {
      case 'open':
        if (target) window.location.href = target;
        return { success: true };

      case 'click':
      case 'clickandwait': {
        const el = findElement(target, targets);
        if (!el) throw new Error('Element not found');
        
        el.scrollIntoView({ block: 'center' });
        el.click();
        return { success: true };
      }

      case 'type': {
        const el = findElement(target, targets);
        if (!el) throw new Error('Element not found');
        
        el.scrollIntoView({ block: 'center' });
        el.focus();
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      }

      case 'select':
      case 'selectandwait': {
        const el = findElement(target, targets);
        if (!el) throw new Error('Element not found');
        
        const options = Array.from(el.options);
        const optValue = value.startsWith('label=') ? value.substring(6) : value;
        const option = options.find(o => o.text === optValue || o.value === optValue);
        
        if (!option) throw new Error('Option not found: ' + value);
        
        el.value = option.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      }

      case 'check': {
        const el = findElement(target, targets);
        if (!el) throw new Error('Element not found');
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      }

      case 'uncheck': {
        const el = findElement(target, targets);
        if (!el) throw new Error('Element not found');
        el.checked = false;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
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
        throw new Error('Unknown command: ' + command);
    }
  }

  console.log('MKP Auto Recorder loaded');
})();
