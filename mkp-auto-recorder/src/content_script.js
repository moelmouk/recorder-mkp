/**
 * MKP Auto Recorder - Content Script v2.1
 * With playback overlay, skip on error, and improved indicator
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

    injectStyles();
    document.body.appendChild(indicatorElement);
    console.log('MKP Recording indicator shown');
  }

  function removeRecordingIndicator() {
    const indicator = document.getElementById('mkp-recording-indicator');
    if (indicator) indicator.remove();
    indicatorElement = null;
  }

  function updateCommandCount(count) {
    const el = document.getElementById('mkp-cmd-count');
    if (el) el.textContent = count;
  }

  // ========== PLAYBACK OVERLAY ==========

  let playbackOverlay = null;
  let skipResolve = null;
  let playbackUiStatus = 'playing';

  function createPlaybackOverlay() {
    removePlaybackOverlay();

    playbackOverlay = document.createElement('div');
    playbackOverlay.id = 'mkp-playback-overlay';
    playbackOverlay.innerHTML = `
      <div class="mkp-playback-inner">
        <div class="mkp-playback-header">
          <div class="mkp-playback-status" id="mkp-playback-status">
            <div class="mkp-play-pulse" id="mkp-play-pulse"></div>
            <span id="mkp-playback-status-text">Lecture en cours</span>
          </div>
          <span class="mkp-playback-progress" id="mkp-progress">0/0</span>
        </div>
        <div class="mkp-playback-info">
          <div class="mkp-step-header">
            <div class="mkp-step-label">
            
              <div class="mkp-playback-actions-box" id="mkp-playback-actions-box">
                <div class="mkp-error-actions">
                  <button class="mkp-btn mkp-btn-retry mkp-btn-pause" id="mkp-btn-pause">
                    <span class="mkp-btn-icon" id="mkp-btn-pause-icon">||</span>
                    <span id="mkp-btn-pause-text">Pause</span>
                  </button>
                  <button class="mkp-btn mkp-btn-stop" id="mkp-btn-stop-main">⏹ Arrêter</button>
                </div>
              </div>
            
            </div>
            
          </div>
          <div class="mkp-step-command" id="mkp-step-command">-</div>
          <div class="mkp-step-target" id="mkp-step-target">-</div>
          <div class="mkp-step-timer" id="mkp-step-timer" aria-live="polite" style="display: none; color: #0066cc; font-size: 14px; margin-top: 10px; font-weight: bold; padding: 5px; background: #f0f8ff; border-radius: 4px;"></div>
        </div>
        <div class="mkp-playback-error" id="mkp-error-box" style="display: none;">
          <div class="mkp-error-text" id="mkp-error-text"></div>
          <div class="mkp-error-actions">
            <button class="mkp-btn mkp-btn-skip" id="mkp-btn-skip">⏭ Passer cette étape</button>
            <button class="mkp-btn mkp-btn-retry" id="mkp-btn-retry">🔄 Réessayer</button>
            <button class="mkp-btn mkp-btn-stop" id="mkp-btn-stop">⏹ Arrêter</button>
          </div>
        </div>
      </div>
    `;

    injectStyles();
    document.body.appendChild(playbackOverlay);

    setPlaybackUiStatus('playing');

    // Button events
    document.getElementById('mkp-btn-pause').addEventListener('click', async () => {
      const nextStatus = playbackUiStatus === 'paused' ? 'playing' : 'paused';
      setPlaybackUiStatus(nextStatus);
      try {
        const type = nextStatus === 'paused' ? 'PAUSE_PLAYBACK' : 'RESUME_PLAYBACK';
        await chrome.runtime.sendMessage({ type });
      } catch (e) {
        console.log('Error toggling pause:', e);
        setPlaybackUiStatus(playbackUiStatus === 'paused' ? 'playing' : 'paused');
      }
    });

    document.getElementById('mkp-btn-stop-main').addEventListener('click', async () => {
      removePlaybackOverlay();
      try {
        await chrome.runtime.sendMessage({ type: 'STOP_PLAYBACK' });
      } catch (e) {
        console.log('Error stopping playback:', e);
      }
    });

    document.getElementById('mkp-btn-skip').addEventListener('click', () => {
      if (skipResolve) skipResolve('skip');
    });
    document.getElementById('mkp-btn-retry').addEventListener('click', () => {
      if (skipResolve) skipResolve('retry');
    });
    document.getElementById('mkp-btn-stop').addEventListener('click', () => {
      if (skipResolve) skipResolve('stop');
      removePlaybackOverlay();
      try {
        chrome.runtime.sendMessage({ type: 'STOP_PLAYBACK' });
      } catch (e) {}
    });

    console.log('MKP Playback overlay shown');
  }

  // ===== Tab playback indicator (favicon + title) =====
  let __mkpOriginalTitle = null;
  let __mkpOriginalFaviconLinks = null;

  function mkpGetFaviconLinks() {
    try {
      return Array.from(document.querySelectorAll('link[rel~="icon"]'));
    } catch (e) { return []; }
  }

  function mkpEnsureOriginalsSaved() {
    if (__mkpOriginalFaviconLinks === null) {
      __mkpOriginalFaviconLinks = mkpGetFaviconLinks().map(link => ({
        rel: link.getAttribute('rel') || 'icon',
        type: link.getAttribute('type') || '',
        href: link.getAttribute('href') || '',
        sizes: link.getAttribute('sizes') || ''
      }));
    }
    if (__mkpOriginalTitle === null) {
      __mkpOriginalTitle = document.title || '';
    }
  }

  function mkpSetFaviconData(svgString) {
    // Remove any previous MKP favicon
    const prev = document.getElementById('mkp-favicon');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

    // Remove existing favicons to avoid conflicts (they will be restored later)
    const existing = mkpGetFaviconLinks();
    existing.forEach(el => el.parentNode && el.parentNode.removeChild(el));

    const link = document.createElement('link');
    link.setAttribute('id', 'mkp-favicon');
    link.setAttribute('rel', 'icon');
    link.setAttribute('type', 'image/svg+xml');
    link.setAttribute('href', 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString));
    document.head.appendChild(link);
  }

  function mkpSetTitlePrefix(prefix) {
    try {
      mkpEnsureOriginalsSaved();
      const base = __mkpOriginalTitle || '';
      document.title = (prefix ? (prefix + ' ' + base) : base);
    } catch (e) {}
  }

  function showTabPlaybackIndicator(status) {
    try {
      mkpEnsureOriginalsSaved();
      if (status === 'paused') {
        const pauseSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#94a3b8"/><rect x="10" y="9" width="4" height="14" rx="1.5" fill="#fff"/><rect x="18" y="9" width="4" height="14" rx="1.5" fill="#fff"/></svg>';
        mkpSetFaviconData(pauseSvg);
        mkpSetTitlePrefix('⏸');
        return;
      }
      // default to playing icon
      const playSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#4f46e5"/><polygon points="12,9 12,23 23,16" fill="#fff"/></svg>';
      mkpSetFaviconData(playSvg);
      mkpSetTitlePrefix('▶');
    } catch (e) {}
  }

  function clearTabPlaybackIndicator() {
    try {
      // Remove MKP favicon
      const prev = document.getElementById('mkp-favicon');
      if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

      // Restore original favicon links
      if (Array.isArray(__mkpOriginalFaviconLinks)) {
        __mkpOriginalFaviconLinks.forEach(data => {
          try {
            const link = document.createElement('link');
            link.setAttribute('rel', data.rel || 'icon');
            if (data.type) link.setAttribute('type', data.type);
            if (data.sizes) link.setAttribute('sizes', data.sizes);
            link.setAttribute('href', data.href);
            document.head.appendChild(link);
          } catch (e) {}
        });
      }

      // Restore original title
      if (__mkpOriginalTitle !== null) {
        document.title = __mkpOriginalTitle;
      }
    } catch (e) {}
  }

  function setPlaybackUiStatus(status) {
    playbackUiStatus = status;

    const statusText = document.getElementById('mkp-playback-status-text');
    const pauseIcon = document.getElementById('mkp-btn-pause-icon');
    const pauseText = document.getElementById('mkp-btn-pause-text');
    const pulse = document.getElementById('mkp-play-pulse');

    if (status === 'paused') {
      if (statusText) statusText.textContent = 'En pause';
      if (pauseIcon) pauseIcon.textContent = '▶️';
      if (pauseText) pauseText.textContent = 'Reprendre';
      if (playbackOverlay) playbackOverlay.classList.add('mkp-paused');
      if (pulse) pulse.setAttribute('aria-label', 'paused');
      showTabPlaybackIndicator('paused');
      return;
    }

    if (status === 'stopped' || status === 'completed' || status === 'error') {
      if (statusText) statusText.textContent = (status === 'error') ? 'Erreur' : (status === 'completed' ? 'Terminée' : 'Arrêtée');
      if (pauseIcon) pauseIcon.textContent = '▶️';
      if (pauseText) pauseText.textContent = 'Reprendre';
      if (playbackOverlay) playbackOverlay.classList.remove('mkp-paused');
      if (pulse) pulse.setAttribute('aria-label', status);
      clearTabPlaybackIndicator();
      return;
    }

    if (statusText) statusText.textContent = 'Lecture en cours';
    if (pauseIcon) pauseIcon.textContent = '||';
    if (pauseText) pauseText.textContent = 'Pause';
    if (playbackOverlay) playbackOverlay.classList.remove('mkp-paused');
    if (pulse) pulse.setAttribute('aria-label', 'playing');
    showTabPlaybackIndicator('playing');
  }

  function removePlaybackOverlay() {
    const overlay = document.getElementById('mkp-playback-overlay');
    if (overlay) overlay.remove();
    playbackOverlay = null;
    skipResolve = null;
    // Also clear tab indicator in case no explicit status is sent
    try { clearTabPlaybackIndicator(); } catch (e) {}
    playbackUiStatus = 'playing';
  }

  let countdownInterval = null;
  
  function updatePlaybackOverlay(current, total, command, delay = 0) {
    const progress = document.getElementById('mkp-progress');
    const cmdEl = document.getElementById('mkp-step-command');
    const targetEl = document.getElementById('mkp-step-target');
    const timerEl = document.getElementById('mkp-step-timer');
    const errorBox = document.getElementById('mkp-error-box');

    // Always clear any local countdown (we rely on background updates to avoid drift)
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    if (progress && Number.isFinite(current) && Number.isFinite(total)) {
      progress.textContent = `${current}/${total}`;
    }

    // command can be null during inter-scenario delay
    const cmdText = command && command.Command ? command.Command : '-';
    if (cmdEl) cmdEl.textContent = cmdText;

    if (targetEl) {
      const target = command && command.Target ? command.Target : '';
      const short = target.length > 60 ? target.substring(0, 60) + '...' : target;
      targetEl.textContent = short || '-';
      targetEl.title = target || '';
    }

    if (timerEl) {
      const infoText = command && typeof command.infoText === 'string' ? command.infoText : '';
      if (infoText) {
        timerEl.textContent = infoText;
        timerEl.style.display = 'block';
      } else if (delay && delay > 0) {
        let text;
        if (delay >= 10000) {
          const mins = Math.floor(delay / 60000);
          const secs = Math.floor((delay % 60000) / 1000);
          const mm = String(mins).padStart(2, '0');
          const ss = String(secs).padStart(2, '0');
          text = `${mm}:${ss}`;
        } else if (delay >= 1000) {
          const secs = (delay / 1000).toFixed(1).replace(/\.0$/, '');
          text = `${secs}s`;
        } else {
          text = `${delay}ms`;
        }
        timerEl.textContent = `Prochain scénario dans: ${text}`;
        timerEl.style.display = 'block';
      } else {
        timerEl.style.display = 'none';
      }
    }

    if (errorBox) errorBox.style.display = 'none';
  }

  function showPlaybackError(errorMessage) {
    console.log('showPlaybackError called with:', errorMessage);
    
    // S'assurer que l'overlay est bien créé
    if (!playbackOverlay) {
      console.log('No playback overlay found, creating one...');
      createPlaybackOverlay();
    }

    const errorBox = document.getElementById('mkp-error-box');
    const errorText = document.getElementById('mkp-error-text');
    const actionsBox = document.getElementById('mkp-playback-actions-box');

    console.log('Error elements:', { errorBox, errorText, actionsBox });

    if (errorBox) {
      errorBox.style.display = 'block';
      errorBox.style.zIndex = '2147483647'; // S'assurer qu'il est au-dessus de tout
    }
    
    if (errorText) {
      errorText.textContent = errorMessage || 'Une erreur inconnue est survenue';
    }
    
    if (actionsBox) {
      actionsBox.style.display = 'none';
    }

    // S'assurer que l'overlay est visible
    if (playbackOverlay) {
      playbackOverlay.style.display = 'block';
      playbackOverlay.style.zIndex = '2147483646'; // Juste en dessous de l'erreur
    }

    // Return a promise that resolves when user clicks a button
    return new Promise((resolve) => {
      console.log('Setting up skipResolve callback');
      skipResolve = (action) => {
        console.log('skipResolve called with action:', action);
        skipResolve = null;
        resolve(action);
      };
      
      // Timeout de sécurité au cas où l'utilisateur ne clique sur aucun bouton
      setTimeout(() => {
        if (skipResolve) {
          console.log('Timeout reached, resolving with skip action');
          skipResolve('skip');
        }
      }, 30000); // 30 secondes de timeout
    });
  }

  function hidePlaybackError() {
    console.log('hidePlaybackError called');
    
    const errorBox = document.getElementById('mkp-error-box');
    const actionsBox = document.getElementById('mkp-playback-actions-box');
    
    if (errorBox) {
      errorBox.style.display = 'none';
      // Réinitialiser les styles si nécessaire
      errorBox.style.zIndex = '';
    }
    
    if (actionsBox) {
      actionsBox.style.display = 'block';
    }
    
    // Nettoyer la référence skipResolve si elle existe
    if (skipResolve) {
      console.log('Cleaning up pending skipResolve');
      const resolve = skipResolve;
      skipResolve = null;
      // Résoudre avec 'skip' pour éviter les blocages
      resolve('skip');
    }
    
    // S'assurer que l'overlay reste visible
    if (playbackOverlay) {
      playbackOverlay.style.display = 'block';
      playbackOverlay.style.zIndex = '2147483646';
    }
  }

  // ========== INJECT STYLES ==========

  function injectStyles() {
    if (document.getElementById('mkp-recorder-styles')) return;

    const style = document.createElement('style');
    style.id = 'mkp-recorder-styles';
    style.textContent = `
      /* Styles de surbrillance modernes */
      @keyframes pulse-glow {
        0% { 
          box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4), 
                      0 0 0 3px rgba(99, 102, 241, 0.4);
        }
        70% {
          box-shadow: 0 0 0 6px rgba(99, 102, 241, 0), 
                      0 0 0 12px rgba(99, 102, 241, 0);
        }
        100% { 
          box-shadow: 0 0 0 0 rgba(99, 102, 241, 0), 
                      0 0 0 0 rgba(99, 102, 241, 0);
        }
      }
      
      .field-highlight {
        position: relative;
        z-index: 9999 !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 4px;
        animation: pulse-glow 2s ease-out;
      }
      
      .field-highlight::before {
        content: '';
        position: absolute;
        top: -3px;
        left: -3px;
        right: -3px;
        bottom: -3px;
        border: 2px solid #6366f1;
        border-radius: 6px;
        pointer-events: none;
        z-index: 10000;
        animation: pulse-glow 2s ease-out;
      }
      
      .field-highlight-click {
        transform: scale(0.98);
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.5) !important;
      }
      
      /* Amélioration pour les champs de formulaire */
      input.field-highlight,
      select.field-highlight,
      textarea.field-highlight,
      [role="textbox"].field-highlight,
      [contenteditable].field-highlight {
        background-color: rgba(99, 102, 241, 0.05) !important;
        border-color: #6366f1 !important;
        box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.3) !important;
      }
      
      /* Style pour les boutons et liens */
      button.field-highlight,
      a.field-highlight,
      [role="button"].field-highlight {
        position: relative;
        z-index: 10001;
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.5) !important;
      }
      
      /* Style pour les cases à cocher et boutons radio */
      [type="checkbox"].field-highlight,
      [type="radio"].field-highlight {
        position: relative;
      }
      
      [type="checkbox"].field-highlight::after,
      [type="radio"].field-highlight::after {
        content: '';
        position: absolute;
        top: -4px;
        left: -4px;
        right: -4px;
        bottom: -4px;
        border: 2px solid #6366f1;
        border-radius: 4px;
        pointer-events: none;
        z-index: 10000;
      }
      
      /* Désactiver l'animation sur mobile pour les performances */
      @media (max-width: 768px) {
        .field-highlight {
          animation: none !important;
          box-shadow: 0 0 0 2px #6366f1 !important;
        }
        .field-highlight::before {
          display: none;
        }
      }
      /* ===== STYLES DE SURBRILLANCE ===== */
      
      /* Style 1 - Moderne & Épuré */
      .highlight-style-modern {
        position: relative;
        z-index: 9999 !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 4px;
        animation: pulse-glow 2s ease-out infinite;
      }
      
      .highlight-style-modern::before {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        border: 2px solid #6366f1;
        border-radius: 4px;
        pointer-events: none;
        z-index: 10000;
      }
      
      /* Style 2 - Classique & Évident */
      .highlight-style-classic {
        position: relative;
        z-index: 9999 !important;
        background-color: rgba(255, 255, 0, 0.2) !important;
        outline: 3px solid #ffcc00 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1) !important;
      }
      
      /* Style 3 - Futuriste */
      .highlight-style-futurist {
        position: relative;
        z-index: 9999 !important;
        border-radius: 4px;
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1)) !important;
        box-shadow: 0 0 15px rgba(99, 102, 241, 0.5), 
                    inset 0 0 10px rgba(255, 255, 255, 0.5);
        animation: neon-pulse 1.5s ease-in-out infinite;
      }
      
      @keyframes neon-pulse {
        0%, 100% { box-shadow: 0 0 10px rgba(99, 102, 241, 0.5), 
                             0 0 20px rgba(99, 102, 241, 0.3),
                             inset 0 0 10px rgba(255, 255, 255, 0.5); }
        50% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.8), 
                         0 0 30px rgba(99, 102, 241, 0.5),
                         inset 0 0 15px rgba(255, 255, 255, 0.8); }
      }
      
      /* Animation de clic commune */
      @keyframes field-click {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(0.98); opacity: 0.8; }
        100% { transform: scale(1); opacity: 1; }
      }
      
      .field-highlight-click {
        animation: field-click 0.3s ease-out !important;
      }
      
      .field-highlight-click {
        transform: scale(0.95) !important;
        transition: transform 0.2s ease !important;
      }
      
      .mkp-step-timer {
        color: #0066cc;
        font-size: 14px;
        margin-top: 10px;
        font-weight: bold;
        padding: 5px;
        background: #f0f8ff;
        border-radius: 4px;
        display: none; /* Sera affiché par le JavaScript quand nécessaire */
      }
      /* Recording Indicator */
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
      .mkp-pulse, .mkp-play-pulse {
        width: 10px;
        height: 10px;
        background: #ef4444;
        border-radius: 50%;
        animation: mkp-pulse 1.5s ease-in-out infinite;
      }
      .mkp-play-pulse {
        background: #6366f1;
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
      .mkp-highlight-strong {
        outline: 3px solid #10b981 !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.25) !important;
        border-radius: 4px !important;
        transition: box-shadow 0.2s ease, outline 0.2s ease;
      }

      /* Playback Overlay */
      #mkp-playback-overlay {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: mkp-slide-up 0.3s ease-out;
      }
      @keyframes mkp-slide-up {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .mkp-playback-inner {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        min-width: 320px;
        max-width: 400px;
        overflow: hidden;
      }
      .mkp-playback-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      .mkp-playback-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: #1e293b;
      }
      .mkp-playback-progress {
        background: #6366f1;
        color: white;
        padding: 4px 10px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 600;
      }
      .mkp-playback-actions-box {
        margin: 0;
        min-width: 0;
        flex-shrink: 1;
        display: flex;
        align-items: center;
        height: 24px;
        gap: 4px;
        margin-left: 8px;
      }
      .mkp-playback-info {
        padding: 16px;
      }
      .mkp-step-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        width: 100%;
        min-width: 0;
        height: 32px; /* Hauteur fixe pour tout le conteneur */
      }
      .mkp-step-label {
        font-size: 10px;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0;
        display: flex;
        align-items: center;
        height: 24px;
        white-space: nowrap;
        padding-right: 8px;
      }
      .mkp-step-command {
        display: inline-block;
        padding: 4px 10px;
        background: #eef2ff;
        color: #6366f1;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .mkp-step-target {
        font-size: 12px;
        color: #64748b;
        font-family: 'Monaco', 'Menlo', monospace;
        word-break: break-all;
        background: #f8fafc;
        padding: 8px 10px;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
      }
      .mkp-playback-error {
        padding: 16px;
        background: #fef2f2;
        border-top: 1px solid #fecaca;
      }
      .mkp-error-text {
        font-size: 13px;
        color: #dc2626;
        margin-bottom: 12px;
        font-weight: 500;
      }
      .mkp-error-actions {
        display: flex;
        gap: 6px; /* Réduit légèrement l'espacement entre les boutons */
        flex-wrap: nowrap;
        justify-content: flex-end;
        min-width: 0; /* Permet au conteneur de rétrécir si nécessaire */
      }
      .mkp-btn {
        padding: 4px 8px;
        border: none;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
        flex-shrink: 0;
        height: 24px;
        display: inline-flex;
        align-items: center;
      }
      .mkp-btn-pause {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .mkp-btn-icon {
        width: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      #mkp-playback-overlay.mkp-paused .mkp-playback-header {
        background: #fff7ed;
      }
      #mkp-playback-overlay.mkp-paused .mkp-play-pulse {
        background: #94a3b8;
        animation: none;
      }
      #mkp-playback-overlay.mkp-paused .mkp-playback-progress {
        background: #94a3b8;
      }
      .mkp-btn-skip {
        background: #f59e0b;
        color: white;
      }
      .mkp-btn-skip:hover {
        background: #d97706;
      }
      .mkp-btn-retry {
        background: #6366f1;
        color: white;
      }
      .mkp-btn-retry:hover {
        background: #4f46e5;
      }
      .mkp-btn-stop {
        background: #64748b;
        color: white;
      }
      .mkp-btn-stop:hover {
        background: #475569;
      }
    `;

    document.head.appendChild(style);
  }

  let currentHighlightedElement = null;
  let highlightTimeout = null;
  let highlightStyle = 'modern'; // Valeur par défaut
  
  // Charger le style de surbrillance depuis le stockage
  chrome.storage.sync.get(['highlightStyle'], function(result) {
    if (result.highlightStyle) {
      highlightStyle = result.highlightStyle;
    }
  });
  
  // Écouter les changements de style
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (changes.highlightStyle) {
      highlightStyle = changes.highlightStyle.newValue;
    }
  });
  
  // Écouter les messages du script de fond
  document.addEventListener('highlightStyleChanged', (e) => {
    if (e.detail && e.detail.style) {
      highlightStyle = e.detail.style;
    }
  });

  // Fonction pour supprimer toutes les surbrillances existantes
  function removeAllHighlights() {
    try {
      // Nettoyer tous les styles de surbrillance
      const highlightClasses = [
        'field-highlight', 
        'highlight-style-modern',
        'highlight-style-classic',
        'highlight-style-futurist',
        'field-highlight-click'
      ];

      // Parcourir tous les éléments avec des classes de surbrillance
      highlightClasses.forEach(className => {
        document.querySelectorAll(`.${className}`).forEach(el => {
          if (el && el.classList) {
            // Supprimer la classe de surbrillance
            el.classList.remove(className);
            
            // Réinitialiser les styles
            const stylesToRemove = [
              'outline', 'outline-offset', 'z-index', 'position', 
              'transition', 'box-shadow', 'background', 'background-color',
              'animation', 'transform'
            ];
            
            stylesToRemove.forEach(prop => {
              el.style.removeProperty(prop);
            });
            
            // Pour les éléments qui avaient une position relative ajoutée
            if (el.style.position === 'relative' && window.getComputedStyle(el).position === 'static') {
              el.style.removeProperty('position');
            }
          }
        });
      });

      // Nettoyer également dans les Shadow DOM
      document.querySelectorAll('*').forEach(el => {
        if (el.shadowRoot) {
          highlightClasses.forEach(className => {
            el.shadowRoot.querySelectorAll(`.${className}`).forEach(shadowEl => {
              if (shadowEl && shadowEl.classList) {
                shadowEl.classList.remove(className);
                shadowEl.removeAttribute('style');
              }
            });
          });
        }
      });

      // Annuler le timeout précédent s'il existe
      if (highlightTimeout) {
        clearTimeout(highlightTimeout);
        highlightTimeout = null;
      }

      currentHighlightedElement = null;
    } catch (e) {
      console.error('Erreur lors du nettoyage des surbrillances:', e);
    }
  }

  function highlightElement(element, duration = 2000) {
    console.log('Highlighting element:', element, 'with style:', highlightStyle);
    if (!element || !element.classList) {
      console.error('Element invalide pour la surbrillance:', element);
      return;
    }
    
    // S'assurer que les styles sont injectés
    if (!document.getElementById('mkp-recorder-styles')) {
      injectStyles();
    }
    
    // Supprimer toutes les surbrillances existantes
    removeAllHighlights();
    
    // Mettre à jour l'élément actuellement surligné
    currentHighlightedElement = element;
    
    // Appliquer le style de surbrillance sélectionné
    const styleClass = `highlight-style-${highlightStyle}`;
    element.classList.add(styleClass);
    
    // Ajouter des styles initiaux pour la transition
    element.style.setProperty('transition', 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 'important');
    element.style.setProperty('z-index', '9999', 'important');
    
    // Pour les éléments qui n'ont pas déjà une position définie
    if (window.getComputedStyle(element).position === 'static') {
      element.style.setProperty('position', 'relative', 'important');
    }
    
    // Appliquer la classe de surbrillance avec un léger délai
    setTimeout(() => {
      // Supprimer tous les styles de surbrillance existants
      element.classList.remove('highlight-style-modern', 'highlight-style-classic', 'highlight-style-futurist');
      
      // Ajouter le style sélectionné
      element.classList.add(styleClass);
      
      // Ajouter un effet de clic
      element.classList.add('field-highlight-click');
      setTimeout(() => {
        element.classList.remove('field-highlight-click');
      }, 300);
    }, 0);
    
    // Faire défiler l'élément dans la vue si nécessaire
    try {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest' 
      });
    } catch (e) {
      console.log('Erreur lors du défilement vers l\'élément:', e);
    }
    
    // Supprimer la surbrillance après la durée spécifiée
    highlightTimeout = setTimeout(() => {
      try {
        if (element && element.classList) {
          // Supprimer la classe de surbrillance
          element.classList.remove('field-highlight');
          
          // Réinitialiser les styles
          element.style.removeProperty('outline');
          element.style.removeProperty('outline-offset');
          element.style.removeProperty('z-index');
          
          // Ne pas réinitialiser la position si elle était déjà définie
          if (element.style.position === 'relative' && window.getComputedStyle(element).position === 'static') {
            element.style.removeProperty('position');
          }
          
          // Supprimer la bordure en pointillés
          const borders = element.getElementsByClassName('mkp-highlight-border');
          Array.from(borders).forEach(border => {
            if (border && border.parentNode) {
              border.parentNode.removeChild(border);
            }
          });
          
          // Forcer le recalcul du style pour s'assurer que les changements sont appliqués
          element.offsetHeight;
        }
      } catch (e) {
        console.error('Erreur lors de la suppression de la surbrillance:', e);
      } finally {
        if (currentHighlightedElement === element) {
          currentHighlightedElement = null;
        }
      }
    }, duration);
  }

  // ========== RECORDING STATE ==========
  
  let isRecording = false;
  let recordedCommands = [];
  let lastRecordedValueByEl = new WeakMap();
  let inputDebounceTimersByEl = new WeakMap();
  
  const MODAL_OPEN_BUTTON_ID = 'market-place_borrower_comparator_comparator-header_button_open-warranties-modal';
  const MODAL_VALIDATE_BUTTON_ID = 'market-place_borrower_comparator_comparator-header_loans-warranties-modal_update-warranties';
  
  let isModalInteractionSuppressed = false;
  let awaitingNetworkCapture = null;
  let networkRequestsRing = [];
  const MAX_NETWORK_REQUESTS = 50;
  let networkMessageListenerAttached = false;
  let lastNeedsContext = { url: '', headers: {} };

  function shouldEnableNetworkInterceptor() {
    try {
      return /(^|\.)april-on\.fr$/i.test(window.location.hostname);
    } catch (e) {
      return false;
    }
  }

  function tryDiscoverNeedsContextFromPerformance() {
    try {
      if (lastNeedsContext && lastNeedsContext.url) return;
      if (!window.performance || typeof window.performance.getEntriesByType !== 'function') return;
      const entries = window.performance.getEntriesByType('resource') || [];
      for (let i = entries.length - 1; i >= 0; i--) {
        const name = entries[i] && entries[i].name ? String(entries[i].name) : '';
        if (!name) continue;
        if (/\/projects\/[a-f0-9]{24}\/needs(\?|$)/i.test(name)) {
          lastNeedsContext = { url: name, headers: {} };
          console.log('[MKP] Needs endpoint discovered from performance entries:', lastNeedsContext.url);
          return;
        }
      }
    } catch (e) {}
  }

  function isIdLocatorFor(locatorTarget, expectedId) {
    if (!locatorTarget || typeof locatorTarget !== 'string') return false;
    return locatorTarget === `id=${expectedId}`;
  }

  function shouldSuppressRecording() {
    return isModalInteractionSuppressed || !!awaitingNetworkCapture;
  }

  function ensureNetworkInterceptorInjected() {
    try {
      if (document.getElementById('mkp-network-interceptor')) return;
      const script = document.createElement('script');
      script.id = 'mkp-network-interceptor';
      script.src = chrome.runtime.getURL('src/network_interceptor.js');
      script.async = false;
      (document.documentElement || document.head || document.body).appendChild(script);
    } catch (e) {
      console.log('MKP: could not inject network interceptor:', e);
    }
  }

  function attachNetworkMessageListener() {
    if (networkMessageListenerAttached) return;
    networkMessageListenerAttached = true;
    window.addEventListener('message', (event) => {
      try {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== 'mkp-network-interceptor' || data.kind !== 'request') return;

        const entry = {
          ts: Number(data.ts) || Date.now(),
          url: String(data.url || ''),
          method: String(data.method || 'GET').toUpperCase(),
          headers: (data.headers && typeof data.headers === 'object') ? data.headers : {},
          body: String(data.body || '')
        };
        
        // Debug log for all captured requests
        console.log('[MKP] Network request captured:', {
          method: entry.method,
          url: entry.url,
          headers: entry.headers,
          body: entry.body,
          timestamp: new Date(entry.ts).toISOString()
        });

        try {
          let fullUrl = entry.url;
          if (fullUrl && fullUrl.startsWith('/')) {
            fullUrl = new URL(fullUrl, window.location.origin).href;
          }
          const isNeedsGet = entry.method === 'GET' && /\/projects\/[a-f0-9]{24}\/needs(\?|$)/i.test(fullUrl);
          if (isNeedsGet) {
            lastNeedsContext = { url: fullUrl, headers: entry.headers || {} };
            console.log('[MKP] Detected current project needs endpoint:', lastNeedsContext.url);
          }
        } catch (e) {}

        networkRequestsRing.push(entry);
        if (networkRequestsRing.length > MAX_NETWORK_REQUESTS) {
          networkRequestsRing = networkRequestsRing.slice(networkRequestsRing.length - MAX_NETWORK_REQUESTS);
        }

        if (awaitingNetworkCapture && typeof awaitingNetworkCapture.resolve === 'function') {
          if (entry.ts >= awaitingNetworkCapture.sinceTs) {
            const isWriteMethod = entry.method === 'POST' || entry.method === 'PUT' || entry.method === 'PATCH' || entry.method === 'DELETE';
            if (isWriteMethod) {
              const resolve = awaitingNetworkCapture.resolve;
              clearTimeout(awaitingNetworkCapture.timeoutId);
              awaitingNetworkCapture = null;
              resolve(entry);
            }
          }
        }
      } catch (e) {}
    }, false);
  }

  async function captureNextNetworkRequestAndRecordCommand() {
    const sinceTs = Date.now();
    console.log('[MKP] En attente de la prochaine requête réseau...');

    const request = await new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        console.log('[MKP] Timeout: Aucune requête réseau capturée dans le délai imparti');
        if (awaitingNetworkCapture && awaitingNetworkCapture.sinceTs === sinceTs) {
          awaitingNetworkCapture = null;
        }
        resolve(null);
      }, 6000);

      awaitingNetworkCapture = { sinceTs, resolve, timeoutId };
    });

    if (!request) {
      console.log('[MKP] Aucune requête réseau capturée');
      return;
    }

    console.log('[MKP] Requête réseau capturée:', {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body,
      timestamp: new Date().toISOString()
    });

    const apiCommand = {
      Command: 'apiRequest',
      Target: request.url,
      Value: request.body || '',
      Targets: [],
      Description: '',
      Method: request.method,
      Headers: request.headers
    };

    recordedCommands.push(apiCommand);
    console.log('[MKP] Commande apiRequest ajoutée au scénario:', apiCommand);
    chrome.runtime.sendMessage({ type: 'COMMAND_RECORDED', command: apiCommand });

    // Ajouter automatiquement une commande refreshPage après apiRequest
    const refreshCommand = {
      Command: 'refreshPage',
      Target: '',
      Value: 'SPECIAL NEEDS CMD',
      Targets: [],
      Description: '',
      timing: 2000
    };

    recordedCommands.push(refreshCommand);
    console.log('[MKP] Commande refreshPage ajoutée automatiquement après apiRequest:', refreshCommand);
    chrome.runtime.sendMessage({ type: 'COMMAND_RECORDED', command: refreshCommand });

    updateCommandCount(recordedCommands.length);
  }

  // ========== EVENT HANDLERS ==========

  const recordClick = (e) => {
    if (!isRecording) return;
    if (e.target.closest('#mkp-recording-indicator')) return;
    if (e.target.closest('#mkp-playback-overlay')) return;

    const target = e.target;
    const locator = getLocator(target);

    const isModalOpen = !!(target && typeof target.closest === 'function' && target.closest(`#${MODAL_OPEN_BUTTON_ID}`));
    const isModalValidate = !!(target && typeof target.closest === 'function' && target.closest(`#${MODAL_VALIDATE_BUTTON_ID}`));
    if (!isModalOpen && !isModalValidate && shouldSuppressRecording()) {
      return;
    }

    if (isModalOpen) {
      isModalInteractionSuppressed = true;
      const command = {
        Command: 'click',
        Target: locator.Target,
        Value: '',
        Targets: locator.Targets,
        Description: '',
        disabled: true
      };

      recordedCommands.push(command);
      chrome.runtime.sendMessage({ type: 'COMMAND_RECORDED', command: command });
      
      highlightElement(target);
      updateCommandCount(recordedCommands.length);
      console.log('MKP Recorded (modal open - disabled):', command);
      return;
    }

    if (isModalValidate && isModalInteractionSuppressed) {
      isModalInteractionSuppressed = false;
      ensureNetworkInterceptorInjected();
      attachNetworkMessageListener();
      captureNextNetworkRequestAndRecordCommand().catch(() => {});
      return;
    }

    const isProfessionOptionClick = (locator.Target || '').includes('profession_input-select_') && !(locator.Target || '').endsWith('jobRefId') && !(locator.Target || '').includes('_jobRefId');
    if (isProfessionOptionClick) {
      const active = document.activeElement;
      if (active) {
        const tagName = active.tagName ? active.tagName.toLowerCase() : '';
        if (tagName === 'input' || tagName === 'textarea') {
          const currentValue = active.value;
          const lastValue = lastRecordedValueByEl.get(active);
          if (currentValue !== lastValue) {
            const activeLocator = getLocator(active);
            const command = {
              Command: 'type',
              Target: activeLocator.Target,
              Value: currentValue,
              Targets: activeLocator.Targets,
              Description: ''
            };

            const prevTimer = inputDebounceTimersByEl.get(active);
            if (prevTimer) {
              clearTimeout(prevTimer);
              inputDebounceTimersByEl.delete(active);
            }

            recordedCommands.push(command);
            lastRecordedValueByEl.set(active, currentValue);
            chrome.runtime.sendMessage({ type: 'COMMAND_RECORDED', command: command });

            highlightElement(active);
            updateCommandCount(recordedCommands.length);
          }
        }
      }
    }

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

  const recordInput = (e) => {
    if (!isRecording) return;
    if (e.target.closest('#mkp-recording-indicator')) return;
    if (e.target.closest('#mkp-playback-overlay')) return;
    if (shouldSuppressRecording()) return;

    const target = e.target;
    const tagName = target.tagName.toLowerCase();
    if (tagName !== 'input' && tagName !== 'textarea') return;

    const prevTimer = inputDebounceTimersByEl.get(target);
    if (prevTimer) clearTimeout(prevTimer);

    const timer = setTimeout(() => {
      if (!isRecording) return;
      if (target.closest('#mkp-recording-indicator')) return;
      if (target.closest('#mkp-playback-overlay')) return;

      const currentValue = target.value;
      const lastValue = lastRecordedValueByEl.get(target);
      if (currentValue === lastValue) return;

      const locator = getLocator(target);
      const command = {
        Command: 'type',
        Target: locator.Target,
        Value: currentValue,
        Targets: locator.Targets,
        Description: ''
      };

      recordedCommands.push(command);
      lastRecordedValueByEl.set(target, currentValue);
      chrome.runtime.sendMessage({ type: 'COMMAND_RECORDED', command: command });

      highlightElement(target);
      updateCommandCount(recordedCommands.length);
    }, 300);

    inputDebounceTimersByEl.set(target, timer);
  };

  const recordChange = (e) => {
    if (!isRecording) return;
    if (e.target.closest('#mkp-recording-indicator')) return;
    if (e.target.closest('#mkp-playback-overlay')) return;
    if (shouldSuppressRecording()) return;

    const target = e.target;
    const tagName = target.tagName.toLowerCase();

    if (tagName === 'input' || tagName === 'textarea') {
      const lastValue = lastRecordedValueByEl.get(target);
      if (target.value === lastValue) return;

      const locator = getLocator(target);
      const command = {
        Command: 'type',
        Target: locator.Target,
        Value: target.value,
        Targets: locator.Targets,
        Description: ''
      };

      recordedCommands.push(command);
      lastRecordedValueByEl.set(target, target.value);
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
    isModalInteractionSuppressed = false;
    awaitingNetworkCapture = null;
    networkRequestsRing = [];
    ensureNetworkInterceptorInjected();
    attachNetworkMessageListener();
    document.addEventListener('click', recordClick, true);
    document.addEventListener('input', recordInput, true);
    document.addEventListener('change', recordChange, true);
    console.log('MKP Recording started');
  };

  const stopRecording = () => {
    isRecording = false;
    isModalInteractionSuppressed = false;
    awaitingNetworkCapture = null;
    document.removeEventListener('click', recordClick, true);
    document.removeEventListener('input', recordInput, true);
    document.removeEventListener('change', recordChange, true);
    console.log('MKP Recording stopped');
  };

  // ========== MESSAGE LISTENER ==========

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Gestion de l'action executeCommand
    if (message.action === 'executeCommand') {
      console.log('Commande reçue pour exécution:', message.command);
      executeCommand(message.command)
        .then(result => {
          console.log('Commande exécutée avec succès:', result);
          sendResponse({ success: true, result });
        })
        .catch(error => {
          console.error('Erreur lors de l\'exécution de la commande:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Indique que la réponse sera asynchrone
    }
    
    // Gestion des autres types de messages
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
      case 'SHOW_PLAYBACK_OVERLAY':
        createPlaybackOverlay();
        chrome.runtime.sendMessage({ type: 'GET_PLAYBACK_STATE' }, (response) => {
          if (response && response.state && response.state.status) {
            if (response.state.status === 'paused') setPlaybackUiStatus('paused');
            else if (response.state.status === 'playing') setPlaybackUiStatus('playing');
          }
        });
        sendResponse({ success: true });
        break;
      case 'HIDE_PLAYBACK_OVERLAY':
        removePlaybackOverlay();
        sendResponse({ success: true });
        break;
      case 'UPDATE_PLAYBACK_OVERLAY':
        console.log('UPDATE_PLAYBACK_OVERLAY received with delay:', message.delay);
        if (message.command && typeof message.infoText === 'string') {
          message.command.infoText = message.infoText;
        }
        updatePlaybackOverlay(message.current, message.total, message.command, message.delay || 0);
        sendResponse({ success: true });
        break;
      case 'SET_PLAYBACK_UI_STATE':
        try {
          if (message.status) setPlaybackUiStatus(message.status);
        } catch (e) {}
        sendResponse({ success: true });
        break;
      case 'SHOW_PLAYBACK_ERROR':
        console.log('SHOW_PLAYBACK_ERROR received with message:', message.error);
        showPlaybackError(message.error)
          .then(action => {
            console.log('User action in SHOW_PLAYBACK_ERROR:', action);
            sendResponse({ success: true, action: action });
          })
          .catch(error => {
            console.error('Error in SHOW_PLAYBACK_ERROR:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Keep channel open for async
      case 'HIDE_PLAYBACK_ERROR':
        hidePlaybackError();
        sendResponse({ success: true });
        break;
      case 'GET_COMMANDS':
        sendResponse({ commands: recordedCommands });
        break;
      case 'GET_NEEDS_CONTEXT':
        console.log('[MKP] GET_NEEDS_CONTEXT - Contexte actuel:', {
          url: lastNeedsContext.url,
          hasHeaders: !!Object.keys(lastNeedsContext.headers || {}).length,
          performanceEntries: window.performance?.getEntriesByType('resource')
            ?.filter(e => e.name.includes('/needs'))
            .map(e => e.name)
        });
        sendResponse({ success: true, context: lastNeedsContext });
        break;
      case 'EXECUTE_COMMAND':
        executeCommand(message.command).then(result => {
          sendResponse(result);
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true;

      case 'HIGHLIGHT_TARGET':
        try {
          const target = message.target;
          const targets = message.targets;
          const el = findElementWithFallback(target, targets, false);
          if (!el) {
            sendResponse({ success: false, error: 'Élément introuvable' });
            break;
          }

          try {
            if (typeof el.scrollIntoView === 'function') {
              el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
          } catch (e) {}

          highlightElement(el);
          try {
            el.classList.add('mkp-highlight-strong');
            setTimeout(() => el.classList.remove('mkp-highlight-strong'), 1200);
          } catch (e) {}

          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: e && e.message ? e.message : 'Erreur highlight' });
        }
        break;
    }
    return true;
  });

  if (shouldEnableNetworkInterceptor()) {
    ensureNetworkInterceptorInjected();
    attachNetworkMessageListener();
    tryDiscoverNeedsContextFromPerformance();
  }

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

  function extractIdFromLocator(locator) {
    if (!locator || typeof locator !== 'string') return '';
    const i = locator.indexOf('=');
    if (i === -1) return '';
    const method = locator.substr(0, i).toLowerCase();
    const value = locator.substr(i + 1);

    if (method === 'id') return value;

    if (method === 'css') {
      const m = value.match(/^#([^\s>+~.:#\[]+)/);
      return m ? m[1] : '';
    }

    if (method === 'xpath') {
      const m = value.match(/@id\s*=\s*("|')([^"']+)("|')/);
      return m ? m[2] : '';
    }

    return '';
  }

  // Fonction pour déclencher correctement les événements de changement Angular
  function triggerAngularInputChange(element, value) {
    if (!element) return false;

    const tag = (element.tagName || '').toLowerCase();
    const proto = tag === 'textarea' ? window.HTMLTextAreaElement?.prototype : window.HTMLInputElement?.prototype;
    const protoSetter = proto ? Object.getOwnPropertyDescriptor(proto, 'value')?.set : null;
    const ownSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;

    // Mise à jour de la valeur (utiliser le setter natif pour que Angular détecte mieux)
    try {
      if (protoSetter && ownSetter !== protoSetter) protoSetter.call(element, value);
      else if (ownSetter) ownSetter.call(element, value);
      else element.value = value;
    } catch (e) {
      element.value = value;
    }

    // Déclenchement des événements natifs
    try {
      element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: value, inputType: 'insertReplacementText' }));
    } catch (e) {
      element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    }
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    
    // Pour Angular
    if (window.ng) {
      try {
        const ngElement = window.ng.getComponent(element) || 
                         window.ng.getContext(element) || 
                         element.__ngContext__;
        if (ngElement) {
          // Essayer de déclencher la détection de changements
          const injector = window.ng.getInjector(element);
          if (injector) {
            const ngZone = injector.get(window.ng.core.NgZone);
            if (ngZone) {
              ngZone.run(() => {
                element.dispatchEvent(new Event('change'));
              });
              return true;
            }
          }
        }
      } catch (e) {
        console.log('Angular detection error:', e);
      }
    }

    // Fallback si Angular n'est pas détecté
    return false;
  }

  function getClientPointForElement(el) {
    try {
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.round(rect.left + rect.width / 2));
      const y = Math.max(0, Math.round(rect.top + rect.height / 2));
      return { x, y };
    } catch (e) {
      return { x: 0, y: 0 };
    }
  }

  function dispatchPointerAndMouseClickSequence(el) {
    if (!el) return;

    try {
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    } catch (e) {}

    const { x, y } = getClientPointForElement(el);
    const common = {
      view: window,
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y
    };

    try {
      if (typeof PointerEvent !== 'undefined') {
        el.dispatchEvent(new PointerEvent('pointerdown', { ...common, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 }));
      }
    } catch (e) {}

    el.dispatchEvent(new MouseEvent('mousedown', { ...common, button: 0, buttons: 1 }));

    try {
      if (typeof PointerEvent !== 'undefined') {
        el.dispatchEvent(new PointerEvent('pointerup', { ...common, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 0 }));
      }
    } catch (e) {}

    el.dispatchEvent(new MouseEvent('mouseup', { ...common, button: 0, buttons: 0 }));
    el.dispatchEvent(new MouseEvent('click', { ...common, button: 0, buttons: 0 }));
  }

  async function executeCommand(cmd) {
    const command = cmd.Command ? cmd.Command.toLowerCase() : '';
    const target = cmd.Target || '';
    const value = cmd.Value || '';
    const targets = cmd.Targets || [];

    console.log('MKP Executing:', command, target, value);

    // Vérifier si c'est une commande apiRequest
  if (command === 'apirequest' || command === 'apiRequest') {
    try {
      const method = cmd.Method || 'GET';
      
      // Récupérer le contexte des besoins pour les en-têtes d'authentification
      const needsContext = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'GET_NEEDS_CONTEXT' }, resolve);
      });
      
      // Utiliser les en-têtes du contexte ou des en-têtes vides par défaut
      const contextHeaders = needsContext?.context?.headers || {};
      
      // Fusionner les en-têtes : d'abord ceux du contexte, puis ceux de la commande
      const headers = {
        'Content-Type': 'application/json',
        ...contextHeaders,
        ...(cmd.Headers || {}) // Les en-têtes de la commande écrasent ceux du contexte
      };
      
      const body = value ? JSON.parse(value) : undefined;
      
      console.log('[MKP] Exécution requête API vers:', target);
      console.log('[MKP] Méthode:', method);
      console.log('[MKP] En-têtes:', Object.keys(headers));
      
      const response = await fetch(target, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include' // Important pour les cookies de session
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} - ${response.statusText}: ${errorText.substring(0, 200)}`);
      }
      
      const responseData = await response.json().catch(() => null);
      return { success: true, data: responseData };
    } catch (error) {
      console.error('[MKP] Erreur lors de l\'exécution de la requête API:', error);
      return { 
        success: false, 
        error: `Erreur API: ${error.message || 'Erreur inconnue'}` 
      };
    }
  }

    switch (command) {
      case 'open':
        if (target) window.location.href = target;
        return { success: true };

      case 'click':
      case 'clickandwait': {
        const isProfessionOption = target.includes('profession_input-select_') && !target.endsWith('jobRefId') && target.includes('_jobRefId') === false;

        let el = findElementWithFallback(target, targets);
        if (!el && isProfessionOption) {
          const maxWait = 8000;
          const interval = 200;
          let waited = 0;
          while (waited < maxWait && !el) {
            await new Promise(r => setTimeout(r, interval));
            waited += interval;
            el = findElementWithFallback(target, targets);
          }
        }

        if (!el) throw new Error(`Élément non trouvé: ${target.substring(0, 50)}`);

        // Vérifier si c'est un clic sur une option de profession
        if (isProfessionOption) {
          // IMPORTANT: on doit réellement cliquer sur l'option pour que ng-select / Angular mette à jour son modèle.
          highlightElement(el, 3000);

          // Ajouter une classe temporaire pour le clic
          el.classList.add('field-highlight-click');
          setTimeout(() => el.classList.remove('field-highlight-click'), 500);

          dispatchPointerAndMouseClickSequence(el);

          // Petit délai pour laisser Angular appliquer la sélection
          await new Promise(r => setTimeout(r, 100));

          // Fallback: certains écrans réinitialisent au blur si la valeur (jobRefId) n'est pas propagée.
          // On tente de cibler le champ associé et de pousser la valeur via setter natif + events.
          let optionId = extractIdFromLocator(target);
          if (!optionId && Array.isArray(targets) && targets.length) {
            for (const t of targets) {
              optionId = extractIdFromLocator(t);
              if (optionId) break;
            }
          }

          if (optionId && optionId.includes('_input-select_')) {
            const baseId = optionId.split('_input-select_')[0];
            const inputIdPrefix = `${baseId}_input-select_`;
            const selector = `[id^="${CSS.escape(inputIdPrefix)}"][id$="_jobRefId"] input`;
            const inputField = document.querySelector(selector);

            if (inputField) {
              const selectedText = (el.textContent || '').trim();
              const selectedValue = el.getAttribute('data-value') || selectedText;
              const type = (inputField.getAttribute('type') || '').toLowerCase();
              const valueToSet = type === 'hidden' ? selectedValue : selectedText;

              triggerAngularInputChange(inputField, valueToSet);
            }
          }

          return { success: true };
        }

        highlightElement(el, 3000);

        // Ajouter une classe temporaire pour le clic
        el.classList.add('field-highlight-click');
        setTimeout(() => el.classList.remove('field-highlight-click'), 500);

        dispatchPointerAndMouseClickSequence(el);
        focusIfEditable(el);
        return { success: true };
      }

      case 'type': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Élément non trouvé: ${target.substring(0, 50)}`);

        highlightElement(el, 3000);
        focusIfEditable(el);

        // Vider le champ
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));

        // Pour les champs sensibles, simuler une saisie progressive
        const isProfessionField = target.includes('profession_input-select') && (target.endsWith('input') || target.includes('/input'));
        if (isProfessionField || target.includes('zipcode') || target.includes('code-postal') || target.includes('postal-code') ||
            target.includes('first-name') || target.includes('surname') || target.includes('last-name') || target.includes('mobile-phone')) {
            if (isProfessionField) {
              try { el.click(); } catch (e) {}
              focusIfEditable(el);
            }

            // Simuler la saisie caractère par caractère
            for (let i = 0; i < value.length; i++) {
                const char = value[i];
                el.value += char;

                // Déclencher les événements pour chaque caractère
                el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
                el.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
                el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
                el.dispatchEvent(new Event('input', { bubbles: true }));

                // Petit délai entre chaque caractère
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Déclencher les événements finaux
            el.dispatchEvent(new Event('change', { bubbles: true }));
            if (!isProfessionField) el.dispatchEvent(new Event('blur', { bubbles: true }));

            // Attendre un peu pour l'auto-complétion
            await new Promise(resolve => setTimeout(resolve, 500));
        } else {
            // Comportement normal pour les autres champs
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }

        return { success: true };
      }

      case 'select':
      case 'selectandwait': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Élément non trouvé: ${target.substring(0, 50)}`);

        highlightElement(el, 3000);
        const options = Array.from(el.getElementsByTagName('option'));
        let option = options.find(op => domText(op).trim() === value || op.text === value || op.value === value);

        if (!option) throw new Error(`Option non trouvée: ${value}`);

        el.value = option.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      }

      case 'check': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Élément non trouvé: ${target.substring(0, 50)}`);
        highlightElement(el, 3000);
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      }

      case 'uncheck': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Élément non trouvé: ${target.substring(0, 50)}`);
        highlightElement(el, 3000);
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
        throw new Error(`Timeout: élément non visible: ${target.substring(0, 50)}`);
      }

      case 'pause': {
        const ms = parseInt(target) || parseInt(value) || 1000;
        await new Promise(r => setTimeout(r, ms));
        return { success: true };
      }

      case 'refreshpage':
        window.location.reload();
        return { success: true };

      default:
        throw new Error(`Commande non supportée: ${command}`);
    }
  }

  console.log('MKP Auto Recorder content script v2.1 loaded');
})();
