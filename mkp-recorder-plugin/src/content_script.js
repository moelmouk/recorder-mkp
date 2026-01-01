/**
 * MKP Recorder - Content Script
 * Basé sur le code de UI.Vision RPA
 * Gère l'enregistrement des actions et l'exécution des commandes
 */

(function() {
  'use strict';

  // Éviter double injection
  if (window.__mkpRecorderLoaded) return;
  window.__mkpRecorderLoaded = true;

  // État du content script
  const state = {
    status: 'NORMAL', // NORMAL, RECORDING, PLAYING
    config: {
      recordClickType: 'click' // 'click' ou 'clickAt'
    }
  };

  // ==================== UTILITAIRES DOM ====================
  
  const domUtils = {
    // Obtenir le texte d'un élément
    domText($dom) {
      const it = $dom.innerText ? $dom.innerText.trim() : '';
      const tc = $dom.textContent || '';
      const pos = tc.toUpperCase().indexOf(it.toUpperCase());
      return pos === -1 ? it : tc.substr(pos, it.length);
    },

    // Vérifier si l'élément est visible
    isVisible(el) {
      if (el === document) return true;
      if (!el) return true;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.opacity === '0' || style.visibility === 'hidden') return false;
      return this.isVisible(el.parentNode);
    },

    // Obtenir l'index d'un élément parmi ses frères de même tag
    getTagIndex(dom) {
      return Array.from(dom.parentNode.childNodes)
        .filter(item => item.nodeType === dom.nodeType && item.tagName === dom.tagName)
        .reduce((prev, node, i) => prev !== null ? prev : (node === dom ? (i + 1) : prev), null);
    },

    // Générer XPath relatif
    relativeXPath(dom) {
      if (!dom) return null;
      if (dom.nodeType === 3) return '@text';
      const index = this.getTagIndex(dom);
      const count = Array.from(dom.parentNode.childNodes)
        .filter(item => item.nodeType === dom.nodeType && item.tagName === dom.tagName).length;
      const tag = dom.tagName.toLowerCase();
      return index > 1 ? `${tag}[${index}]` : tag;
    },

    // Générer XPath complet
    xpath(dom, cur, list) {
      const helper = (dom, cur, list) => {
        if (!dom) return null;
        if (!cur) {
          if (dom.nodeType === 3) {
            return helper(dom.parentNode);
          } else {
            return helper(dom, dom, []);
          }
        }
        if (!cur.parentNode) return ['html'].concat(list);
        if (cur.tagName === 'BODY') return ['html', 'body'].concat(list);
        if (cur.id) return [`*[@id="${cur.id}"]`].concat(list);
        return helper(dom, cur.parentNode, [this.relativeXPath(cur)].concat(list));
      };

      const parts = helper(dom, cur, list);
      const prefix = parts[0] === 'html' ? '/' : '//';
      return prefix + parts.join('/');
    },

    // Générer sélecteur CSS
    cssSelector(dom) {
      if (!dom || dom.nodeType !== 1) return '';
      if (dom.tagName === 'BODY') return 'body';
      if (dom.id) return '#' + dom.id;

      const classes = (dom.className || '').split(/\s+/g).filter(item => item && item.length);
      const children = Array.from(dom.parentNode?.childNodes || []).filter(el => el.nodeType === 1);
      const sameTag = children.filter(el => el.tagName === dom.tagName);

      let extra = '';
      if (sameTag.length === 1) {
        extra = '';
      } else if (classes.length) {
        const sameClass = children.filter(el => {
          const cs = (el.className || '').split(/\s+/g);
          return classes.every(c => cs.includes(c));
        });
        if (sameClass.length === 1) {
          extra = '.' + classes.join('.');
        } else {
          extra = ':nth-child(' + (1 + children.findIndex(item => item === dom)) + ')';
        }
      } else {
        extra = ':nth-child(' + (1 + children.findIndex(item => item === dom)) + ')';
      }

      return this.cssSelector(dom.parentNode) + ' > ' + dom.tagName.toLowerCase() + extra;
    },

    // Obtenir le locator d'un élément
    getLocator($dom, withAllOptions = false) {
      const id = $dom.getAttribute('id');
      const name = $dom.getAttribute('name');
      const isLink = $dom.tagName.toLowerCase() === 'a';
      const text = (() => { try { return this.domText($dom); } catch (e) { return null; } })();
      const candidates = [];

      // ID
      if (id && id.length) {
        candidates.push(`id=${id}`);
      }

      // Name
      if (name && name.length) {
        candidates.push(`name=${name}`);
      }

      // Link text
      if (isLink && text && text.length) {
        candidates.push(`linkText=${text}`);
      }

      // XPath
      candidates.push('xpath=' + this.xpath($dom));

      // CSS
      candidates.push(`css=${this.cssSelector($dom)}`);

      if (withAllOptions) {
        return {
          target: candidates[0],
          targetOptions: candidates
        };
      }

      return candidates[0];
    },

    // Trouver un élément par locator
    getElementByLocator(str, shouldWaitForVisible = false) {
      const i = str.indexOf('=');
      let el;

      if (/^\//.test(str)) {
        // XPath direct
        el = this.getElementByXPath(str);
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
          case 'css':
            el = document.querySelector(value);
            break;
          case 'xpath':
            el = this.getElementByXPath(value);
            break;
          case 'linktext':
          case 'link':
            const links = Array.from(document.getElementsByTagName('a'));
            el = links.find(a => this.domText(a).trim() === value);
            break;
          default:
            throw new Error('Unsupported locator method: ' + method);
        }
      }

      if (!el) {
        throw new Error('Element not found: ' + str);
      }

      if (shouldWaitForVisible && !this.isVisible(el)) {
        throw new Error('Element found but not visible: ' + str);
      }

      return el;
    },

    getElementByXPath(xpath) {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue;
    },

    // Vérifier si l'élément est éditable
    isEditable(el) {
      const tag = (el.tagName || '').toLowerCase();
      if (el.contentEditable === 'true') return true;
      if (['input', 'textarea'].includes(tag)) {
        return !el.disabled && !el.readOnly;
      }
      return false;
    }
  };

  // ==================== ENREGISTREMENT ====================

  const recorder = {
    reportCommand(obj) {
      if (state.status !== 'RECORDING') return;
      
      const command = { ...obj, url: window.location.href };
      console.log('MKP Recording:', command);
      
      chrome.runtime.sendMessage({
        type: 'CS_RECORD_COMMAND',
        data: command
      }).catch(e => console.log('Failed to send command:', e));
    },

    onClick(e) {
      const target = e.target;
      const locatorInfo = domUtils.getLocator(target, true);
      
      if (state.config.recordClickType === 'clickAt') {
        const rect = target.getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);
        recorder.reportCommand({
          cmd: 'clickAt',
          ...locatorInfo,
          value: `${x},${y}`
        });
      } else {
        recorder.reportCommand({
          cmd: 'click',
          ...locatorInfo,
          value: ''
        });
      }
    },

    onChange(e) {
      const target = e.target;
      const tag = target.tagName.toLowerCase();
      const locatorInfo = domUtils.getLocator(target, true);

      if (tag === 'select') {
        const selectedOption = target.options[target.selectedIndex];
        recorder.reportCommand({
          cmd: 'select',
          ...locatorInfo,
          value: 'label=' + selectedOption.text.trim()
        });
      } else if (tag === 'input' || tag === 'textarea') {
        const type = target.getAttribute('type');
        if (type === 'checkbox' || type === 'radio') {
          recorder.reportCommand({
            cmd: target.checked ? 'check' : 'uncheck',
            ...locatorInfo,
            value: ''
          });
        } else {
          recorder.reportCommand({
            cmd: 'type',
            ...locatorInfo,
            value: target.value
          });
        }
      }
    },

    onFocus(e) {
      // Utilisé pour détecter les champs de saisie
    },

    bindEvents() {
      document.addEventListener('click', this.onClick, true);
      document.addEventListener('change', this.onChange, true);
      document.addEventListener('focus', this.onFocus, true);
    },

    unbindEvents() {
      document.removeEventListener('click', this.onClick, true);
      document.removeEventListener('change', this.onChange, true);
      document.removeEventListener('focus', this.onFocus, true);
    }
  };

  // ==================== EXÉCUTION DES COMMANDES ====================

  const commandRunner = {
    async run(command) {
      const { cmd, target, value } = command;
      console.log('MKP Running command:', cmd, target, value);

      switch (cmd) {
        case 'open':
          window.location.href = target;
          return { success: true };

        case 'click':
        case 'clickAndWait': {
          const el = domUtils.getElementByLocator(target);
          this.highlightElement(el);
          el.click();
          return { success: true };
        }

        case 'clickAt': {
          const el = domUtils.getElementByLocator(target);
          this.highlightElement(el);
          const [x, y] = (value || '0,0').split(',').map(n => parseInt(n.trim(), 10));
          const rect = el.getBoundingClientRect();
          ['mousedown', 'mouseup', 'click'].forEach(eventType => {
            el.dispatchEvent(new MouseEvent(eventType, {
              view: window,
              bubbles: true,
              cancelable: true,
              clientX: rect.left + x,
              clientY: rect.top + y
            }));
          });
          return { success: true };
        }

        case 'type': {
          const el = domUtils.getElementByLocator(target);
          this.highlightElement(el);
          el.focus();
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true };
        }

        case 'sendKeys': {
          const el = domUtils.getElementByLocator(target);
          this.highlightElement(el);
          el.focus();
          // Simuler les touches
          for (const char of value) {
            el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
              el.value += char;
            }
            el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true };
        }

        case 'select': {
          const el = domUtils.getElementByLocator(target);
          this.highlightElement(el);
          const [type, val] = value.split('=');
          const options = Array.from(el.options);
          let option;
          
          switch (type) {
            case 'label':
              option = options.find(o => o.text.trim() === val);
              break;
            case 'value':
              option = options.find(o => o.value === val);
              break;
            case 'index':
              option = options[parseInt(val, 10)];
              break;
            default:
              option = options.find(o => o.text.trim() === value);
          }
          
          if (option) {
            el.value = option.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return { success: true };
        }

        case 'check':
        case 'uncheck': {
          const el = domUtils.getElementByLocator(target);
          this.highlightElement(el);
          el.checked = cmd === 'check';
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true };
        }

        case 'mouseOver': {
          const el = domUtils.getElementByLocator(target);
          this.highlightElement(el);
          el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          return { success: true };
        }

        case 'waitForElementPresent': {
          await this.waitFor(() => {
            try {
              domUtils.getElementByLocator(target, false);
              return true;
            } catch (e) {
              return false;
            }
          }, 10000);
          return { success: true };
        }

        case 'waitForElementVisible': {
          await this.waitFor(() => {
            try {
              domUtils.getElementByLocator(target, true);
              return true;
            } catch (e) {
              return false;
            }
          }, 10000);
          return { success: true };
        }

        case 'waitForElementNotPresent': {
          await this.waitFor(() => {
            try {
              domUtils.getElementByLocator(target, false);
              return false;
            } catch (e) {
              return true;
            }
          }, 10000);
          return { success: true };
        }

        case 'waitForElementNotVisible': {
          await this.waitFor(() => {
            try {
              const el = domUtils.getElementByLocator(target, false);
              return !domUtils.isVisible(el);
            } catch (e) {
              return true;
            }
          }, 10000);
          return { success: true };
        }

        case 'pause': {
          const ms = parseInt(target, 10) || parseInt(value, 10) || 1000;
          await this.delay(ms);
          return { success: true };
        }

        case 'verifyText': {
          const el = domUtils.getElementByLocator(target);
          const text = domUtils.domText(el);
          if (!this.globMatch(value, text)) {
            return { success: false, error: `Text not matched. Expected: "${value}", Actual: "${text}"` };
          }
          return { success: true };
        }

        case 'verifyTitle': {
          if (!this.globMatch(target, document.title)) {
            return { success: false, error: `Title not matched. Expected: "${target}", Actual: "${document.title}"` };
          }
          return { success: true };
        }

        case 'verifyValue': {
          const el = domUtils.getElementByLocator(target);
          if (!this.globMatch(value, el.value)) {
            return { success: false, error: `Value not matched. Expected: "${value}", Actual: "${el.value}"` };
          }
          return { success: true };
        }

        case 'verifyElementPresent': {
          try {
            domUtils.getElementByLocator(target);
            return { success: true };
          } catch (e) {
            return { success: false, error: `Element not present: ${target}` };
          }
        }

        case 'assertText': {
          const el = domUtils.getElementByLocator(target);
          const text = domUtils.domText(el);
          if (!this.globMatch(value, text)) {
            throw new Error(`Text not matched. Expected: "${value}", Actual: "${text}"`);
          }
          return { success: true };
        }

        case 'assertTitle': {
          if (!this.globMatch(target, document.title)) {
            throw new Error(`Title not matched. Expected: "${target}", Actual: "${document.title}"`);
          }
          return { success: true };
        }

        case 'assertElementPresent': {
          domUtils.getElementByLocator(target);
          return { success: true };
        }

        case 'storeText': {
          const el = domUtils.getElementByLocator(target);
          return { success: true, vars: { [value]: domUtils.domText(el) } };
        }

        case 'storeValue': {
          const el = domUtils.getElementByLocator(target);
          return { success: true, vars: { [value]: el.value } };
        }

        case 'storeTitle': {
          return { success: true, vars: { [value]: document.title } };
        }

        case 'storeAttribute': {
          const atIndex = target.lastIndexOf('@');
          const locator = target.substr(0, atIndex);
          const attrName = target.substr(atIndex + 1);
          const el = domUtils.getElementByLocator(locator);
          return { success: true, vars: { [value]: el.getAttribute(attrName) } };
        }

        case 'echo': {
          console.log('Echo:', target);
          return { success: true, echo: target };
        }

        case 'editContent': {
          const el = domUtils.getElementByLocator(target);
          this.highlightElement(el);
          el.innerHTML = value;
          return { success: true };
        }

        case 'selectFrame': {
          // Gestion basique des frames
          if (target === 'relative=top') {
            // Revenir au top
            return { success: true, frameAction: 'top' };
          } else if (target === 'relative=parent') {
            return { success: true, frameAction: 'parent' };
          } else if (target.startsWith('index=')) {
            const index = parseInt(target.split('=')[1], 10);
            return { success: true, frameAction: 'index', frameIndex: index };
          }
          return { success: true };
        }

        default:
          return { success: false, error: `Unknown command: ${cmd}` };
      }
    },

    highlightElement(el, duration = 500) {
      const originalOutline = el.style.outline;
      const originalBackground = el.style.backgroundColor;
      
      el.style.outline = '2px solid #4fc3f7';
      el.style.backgroundColor = 'rgba(79, 195, 247, 0.2)';
      
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      setTimeout(() => {
        el.style.outline = originalOutline;
        el.style.backgroundColor = originalBackground;
      }, duration);
    },

    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    async waitFor(condition, timeout = 10000, interval = 100) {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        if (condition()) return true;
        await this.delay(interval);
      }
      throw new Error('Timeout waiting for condition');
    },

    globMatch(pattern, text) {
      if (!pattern) return true;
      // Simple glob matching (supports * as wildcard)
      const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      return new RegExp(`^${regexPattern}$`, 'i').test(text);
    }
  };

  // ==================== GESTION DES MESSAGES ====================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('CS received:', message.type, message);
    
    handleMessage(message)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ error: error.message }));
    
    return true;
  });

  async function handleMessage(message) {
    const { type, data } = message;

    switch (type) {
      case 'SET_STATUS':
        state.status = data.status;
        if (data.status === 'RECORDING') {
          recorder.bindEvents();
        } else {
          recorder.unbindEvents();
        }
        return { success: true };

      case 'GET_STATUS':
        return { status: state.status };

      case 'RUN_COMMAND':
        return await commandRunner.run(data);

      case 'HIGHLIGHT_ELEMENT':
        try {
          const el = domUtils.getElementByLocator(data.locator);
          commandRunner.highlightElement(el, 2000);
          return { success: true };
        } catch (e) {
          return { success: false, error: e.message };
        }

      case 'GET_LOCATOR':
        // Pour l'inspecteur futur
        return { success: true };

      default:
        return { error: 'Unknown message type' };
    }
  }

  // Informer le background que le content script est prêt
  chrome.runtime.sendMessage({ type: 'CS_READY' }).catch(() => {});

  console.log('MKP Recorder content script loaded');
})();
