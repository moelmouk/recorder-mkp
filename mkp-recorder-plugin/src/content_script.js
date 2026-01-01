/**
 * MKP Recorder - Content Script
 * Basé sur le code de UI.Vision RPA
 * Gère l'enregistrement des actions et l'exécution des commandes
 */

(function() {
  'use strict';

  // Éviter double injection
  if (window.__mkpRecorderLoaded) {
    console.log('MKP Recorder already loaded');
    return;
  }
  window.__mkpRecorderLoaded = true;

  console.log('MKP Recorder content script loading...');

  // État du content script
  const state = {
    status: 'NORMAL' // NORMAL, RECORDING, PLAYING
  };

  // ==================== UTILITAIRES DOM ====================
  
  const domUtils = {
    domText($dom) {
      if (!$dom) return '';
      const it = $dom.innerText ? $dom.innerText.trim() : '';
      const tc = $dom.textContent || '';
      const pos = tc.toUpperCase().indexOf(it.toUpperCase());
      return pos === -1 ? it : tc.substr(pos, it.length);
    },

    isVisible(el) {
      if (!el || el === document) return true;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.opacity === '0' || style.visibility === 'hidden') return false;
      return this.isVisible(el.parentNode);
    },

    getTagIndex(dom) {
      if (!dom || !dom.parentNode) return 1;
      return Array.from(dom.parentNode.childNodes)
        .filter(item => item.nodeType === 1 && item.tagName === dom.tagName)
        .indexOf(dom) + 1;
    },

    relativeXPath(dom) {
      if (!dom || dom.nodeType !== 1) return '';
      const index = this.getTagIndex(dom);
      const siblings = Array.from(dom.parentNode.childNodes)
        .filter(item => item.nodeType === 1 && item.tagName === dom.tagName);
      const tag = dom.tagName.toLowerCase();
      return siblings.length > 1 ? `${tag}[${index}]` : tag;
    },

    xpath(dom) {
      if (!dom || dom.nodeType !== 1) return '';
      
      const parts = [];
      let current = dom;
      
      while (current && current.nodeType === 1) {
        if (current.id) {
          parts.unshift(`*[@id="${current.id}"]`);
          break;
        }
        if (current.tagName.toLowerCase() === 'body') {
          parts.unshift('body');
          parts.unshift('html');
          break;
        }
        if (current.tagName.toLowerCase() === 'html') {
          parts.unshift('html');
          break;
        }
        parts.unshift(this.relativeXPath(current));
        current = current.parentNode;
      }
      
      const prefix = parts[0] === 'html' || parts[0]?.startsWith('*[@id') ? '/' : '//';
      return prefix + parts.join('/');
    },

    cssSelector(dom) {
      if (!dom || dom.nodeType !== 1) return '';
      if (dom.tagName.toLowerCase() === 'body') return 'body';
      if (dom.id) return '#' + CSS.escape(dom.id);

      const tag = dom.tagName.toLowerCase();
      const parent = dom.parentNode;
      
      if (!parent || parent.nodeType !== 1) return tag;

      const siblings = Array.from(parent.children).filter(el => el.tagName === dom.tagName);
      
      if (siblings.length === 1) {
        return this.cssSelector(parent) + ' > ' + tag;
      }
      
      const index = siblings.indexOf(dom) + 1;
      return this.cssSelector(parent) + ' > ' + tag + ':nth-of-type(' + index + ')';
    },

    getLocator($dom) {
      if (!$dom || $dom.nodeType !== 1) return { target: '', targetOptions: [] };
      
      const candidates = [];
      const id = $dom.getAttribute('id');
      const name = $dom.getAttribute('name');

      // ID (préféré)
      if (id && id.length && !id.match(/^\d/)) {
        candidates.push(`id=${id}`);
      }

      // Name
      if (name && name.length) {
        candidates.push(`name=${name}`);
      }

      // XPath
      try {
        const xp = this.xpath($dom);
        if (xp) candidates.push('xpath=' + xp);
      } catch (e) {}

      // CSS
      try {
        const css = this.cssSelector($dom);
        if (css) candidates.push('css=' + css);
      } catch (e) {}

      return {
        target: candidates[0] || '',
        targetOptions: candidates
      };
    },

    getElementByLocator(str, shouldWaitForVisible = false) {
      if (!str) throw new Error('Empty locator');
      
      const i = str.indexOf('=');
      let el;

      if (str.startsWith('/')) {
        el = this.getElementByXPath(str);
      } else if (i === -1) {
        throw new Error('Invalid locator: ' + str);
      } else {
        const method = str.substr(0, i).toLowerCase();
        const value = str.substr(i + 1);

        switch (method) {
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

      if (!el) throw new Error('Element not found: ' + str);
      if (shouldWaitForVisible && !this.isVisible(el)) {
        throw new Error('Element found but not visible: ' + str);
      }
      return el;
    },

    getElementByXPath(xpath) {
      const result = document.evaluate(
        xpath, document, null,
        XPathResult.FIRST_ORDERED_NODE_TYPE, null
      );
      return result.singleNodeValue;
    }
  };

  // ==================== ENREGISTREMENT ====================

  const recorder = {
    boundEvents: false,

    reportCommand(cmdObj) {
      if (state.status !== 'RECORDING') return;
      
      console.log('MKP Recording:', cmdObj);
      
      chrome.runtime.sendMessage({
        type: 'CS_RECORD_COMMAND',
        data: {
          cmd: cmdObj.cmd,
          target: cmdObj.target || '',
          value: cmdObj.value || '',
          targetOptions: cmdObj.targetOptions || []
        }
      }).catch(e => console.log('Failed to send:', e.message));
    },

    onClick(e) {
      if (state.status !== 'RECORDING') return;
      
      const target = e.target;
      if (!target || target.nodeType !== 1) return;
      
      // Ignorer les clics sur les éléments de l'extension
      if (target.closest('[data-mkp-recorder]')) return;
      
      const locatorInfo = domUtils.getLocator(target);
      
      recorder.reportCommand({
        cmd: 'click',
        ...locatorInfo
      });
    },

    onChange(e) {
      if (state.status !== 'RECORDING') return;
      
      const target = e.target;
      if (!target || target.nodeType !== 1) return;
      
      const tag = target.tagName.toLowerCase();
      const locatorInfo = domUtils.getLocator(target);

      if (tag === 'select') {
        const selectedOption = target.options[target.selectedIndex];
        if (selectedOption) {
          recorder.reportCommand({
            cmd: 'select',
            ...locatorInfo,
            value: 'label=' + selectedOption.text.trim()
          });
        }
      } else if (tag === 'input' || tag === 'textarea') {
        const type = (target.getAttribute('type') || '').toLowerCase();
        if (type === 'checkbox' || type === 'radio') {
          recorder.reportCommand({
            cmd: target.checked ? 'check' : 'uncheck',
            ...locatorInfo
          });
        } else if (type !== 'submit' && type !== 'button') {
          recorder.reportCommand({
            cmd: 'type',
            ...locatorInfo,
            value: target.value || ''
          });
        }
      }
    },

    bindEvents() {
      if (this.boundEvents) return;
      this.boundEvents = true;
      
      console.log('MKP Binding recording events');
      document.addEventListener('click', this.onClick, true);
      document.addEventListener('change', this.onChange, true);
    },

    unbindEvents() {
      if (!this.boundEvents) return;
      this.boundEvents = false;
      
      console.log('MKP Unbinding recording events');
      document.removeEventListener('click', this.onClick, true);
      document.removeEventListener('change', this.onChange, true);
    }
  };

  // ==================== EXÉCUTION DES COMMANDES ====================

  const commandRunner = {
    async run(command) {
      const { cmd, target, value } = command;
      console.log('MKP Running:', cmd, target, value);

      try {
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

          case 'type': {
            const el = domUtils.getElementByLocator(target);
            this.highlightElement(el);
            el.focus();
            el.value = value || '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true };
          }

          case 'select': {
            const el = domUtils.getElementByLocator(target);
            this.highlightElement(el);
            
            const parts = (value || '').split('=');
            const type = parts[0];
            const val = parts.slice(1).join('=');
            const options = Array.from(el.options || []);
            let option;
            
            if (type === 'label') {
              option = options.find(o => o.text.trim() === val);
            } else if (type === 'value') {
              option = options.find(o => o.value === val);
            } else if (type === 'index') {
              option = options[parseInt(val, 10)];
            } else {
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

          case 'waitForElementPresent': {
            await this.waitFor(() => {
              try { domUtils.getElementByLocator(target); return true; } 
              catch (e) { return false; }
            }, 10000);
            return { success: true };
          }

          case 'waitForElementVisible': {
            await this.waitFor(() => {
              try { domUtils.getElementByLocator(target, true); return true; } 
              catch (e) { return false; }
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
            if (text !== value && !text.includes(value)) {
              return { success: false, error: `Text not matched. Expected: "${value}", Actual: "${text}"` };
            }
            return { success: true };
          }

          case 'verifyTitle': {
            if (document.title !== target && !document.title.includes(target)) {
              return { success: false, error: `Title not matched. Expected: "${target}", Actual: "${document.title}"` };
            }
            return { success: true };
          }

          case 'assertText': {
            const el = domUtils.getElementByLocator(target);
            const text = domUtils.domText(el);
            if (text !== value && !text.includes(value)) {
              throw new Error(`Text not matched. Expected: "${value}", Actual: "${text}"`);
            }
            return { success: true };
          }

          case 'storeText': {
            const el = domUtils.getElementByLocator(target);
            return { success: true, vars: { [value]: domUtils.domText(el) } };
          }

          case 'storeValue': {
            const el = domUtils.getElementByLocator(target);
            return { success: true, vars: { [value]: el.value || '' } };
          }

          case 'storeTitle': {
            return { success: true, vars: { [value]: document.title } };
          }

          case 'echo': {
            console.log('Echo:', target);
            return { success: true, echo: target };
          }

          case 'mouseOver': {
            const el = domUtils.getElementByLocator(target);
            this.highlightElement(el);
            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            return { success: true };
          }

          default:
            console.log('Unknown command:', cmd);
            return { success: true }; // Ignorer les commandes inconnues
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    },

    highlightElement(el, duration = 500) {
      if (!el) return;
      const orig = el.style.cssText;
      el.style.outline = '3px solid #4fc3f7';
      el.style.backgroundColor = 'rgba(79, 195, 247, 0.3)';
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { el.style.cssText = orig; }, duration);
    },

    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    async waitFor(condition, timeout = 10000, interval = 100) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (condition()) return true;
        await this.delay(interval);
      }
      throw new Error('Timeout waiting for condition');
    }
  };

  // ==================== GESTION DES MESSAGES ====================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('CS received:', message.type);
    
    const { type, data } = message;

    switch (type) {
      case 'SET_STATUS':
        console.log('Setting status to:', data.status);
        state.status = data.status;
        if (data.status === 'RECORDING') {
          recorder.bindEvents();
        } else {
          recorder.unbindEvents();
        }
        sendResponse({ success: true });
        return true;

      case 'GET_STATUS':
        sendResponse({ status: state.status });
        return true;

      case 'RUN_COMMAND':
        commandRunner.run(data)
          .then(response => sendResponse(response))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'HIGHLIGHT_ELEMENT':
        try {
          const el = domUtils.getElementByLocator(data.locator);
          commandRunner.highlightElement(el, 2000);
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        return true;

      default:
        sendResponse({ error: 'Unknown message type' });
        return true;
    }
  });

  // Informer le background que le content script est prêt
  chrome.runtime.sendMessage({ type: 'CS_READY' }).catch(() => {});

  console.log('MKP Recorder content script loaded on:', window.location.href);
})();
