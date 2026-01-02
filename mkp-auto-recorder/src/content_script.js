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

  // ========== EVENT HANDLERS ==========
  const recordClick = (e) => {
    if (!isRecording) return;

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

    console.log('MKP Recorded:', command);
  };

  const recordChange = (e) => {
    if (!isRecording) return;

    const target = e.target;
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
    }
  };

  const recordCheck = (e) => {
    if (!isRecording) return;

    const target = e.target;
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

  // ========== COMMAND EXECUTOR (PLAYER) ==========
  async function executeCommand(cmd) {
    console.log('MKP Executing:', cmd.Command, cmd.Target);

    const element = await findElement(cmd.Target, cmd.Targets || []);
    
    if (!element) {
      throw new Error(`Element not found: ${cmd.Target}`);
    }

    switch (cmd.Command.toLowerCase()) {
      case 'click':
        element.click();
        break;

      case 'type':
        if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
          element.value = cmd.Value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
        break;

      case 'select':
        if (element.tagName.toLowerCase() === 'select') {
          const options = Array.from(element.options);
          const option = options.find(opt => opt.text === cmd.Value);
          if (option) {
            element.value = option.value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        break;

      case 'check':
        if (element.type === 'checkbox' || element.type === 'radio') {
          element.checked = true;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
        break;

      case 'uncheck':
        if (element.type === 'checkbox') {
          element.checked = false;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
        break;

      default:
        throw new Error(`Unknown command: ${cmd.Command}`);
    }

    return { success: true };
  }

  async function findElement(target, targets) {
    // Try main target first
    let element = findElementByLocator(target);
    if (element) return element;

    // Try alternative targets
    for (const alt of targets) {
      element = findElementByLocator(alt);
      if (element) return element;
    }

    return null;
  }

  function findElementByLocator(locator) {
    try {
      if (locator.startsWith('id=')) {
        const id = locator.substring(3);
        return document.getElementById(id);
      } else if (locator.startsWith('name=')) {
        const name = locator.substring(5);
        return document.querySelector(`[name="${name}"]`);
      } else if (locator.startsWith('xpath=')) {
        const xpath = locator.substring(6);
        return getElementByXPath(xpath);
      } else if (locator.startsWith('css=')) {
        const css = locator.substring(4);
        return document.querySelector(css);
      } else if (locator.startsWith('linkText=')) {
        const text = locator.substring(9);
        const links = Array.from(document.getElementsByTagName('a'));
        return links.find(a => a.innerText.trim() === text);
      }
    } catch (e) {
      console.error('Error finding element:', e);
    }
    return null;
  }

  console.log('MKP Auto Recorder content script loaded');
})();
