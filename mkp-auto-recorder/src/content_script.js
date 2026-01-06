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
      return;
    }

    if (status === 'stopped') {
      if (statusText) statusText.textContent = 'Arrêtée';
      if (pauseIcon) pauseIcon.textContent = '▶️';
      if (pauseText) pauseText.textContent = 'Reprendre';
      if (playbackOverlay) playbackOverlay.classList.remove('mkp-paused');
      if (pulse) pulse.setAttribute('aria-label', 'stopped');
      return;
    }

    if (statusText) statusText.textContent = 'Lecture en cours';
    if (pauseIcon) pauseIcon.textContent = '||';
    if (pauseText) pauseText.textContent = 'Pause';
    if (playbackOverlay) playbackOverlay.classList.remove('mkp-paused');
    if (pulse) pulse.setAttribute('aria-label', 'playing');
  }

  function removePlaybackOverlay() {
    const overlay = document.getElementById('mkp-playback-overlay');
    if (overlay) overlay.remove();
    playbackOverlay = null;
    skipResolve = null;
    playbackUiStatus = 'playing';
  }

  function updatePlaybackOverlay(current, total, command) {
    const progress = document.getElementById('mkp-progress');
    const cmdEl = document.getElementById('mkp-step-command');
    const targetEl = document.getElementById('mkp-step-target');
    const errorBox = document.getElementById('mkp-error-box');

    if (progress) progress.textContent = `${current}/${total}`;
    if (cmdEl) cmdEl.textContent = command.Command || '-';
    if (targetEl) {
      const target = command.Target || '';
      targetEl.textContent = target.length > 60 ? target.substring(0, 60) + '...' : target;
      targetEl.title = target;
    }
    if (errorBox) errorBox.style.display = 'none';
  }

  function showPlaybackError(errorMessage) {
    const errorBox = document.getElementById('mkp-error-box');
    const errorText = document.getElementById('mkp-error-text');
    const actionsBox = document.getElementById('mkp-playback-actions-box');

    if (errorBox) errorBox.style.display = 'block';
    if (errorText) errorText.textContent = errorMessage;
    if (actionsBox) actionsBox.style.display = 'none';

    // Return a promise that resolves when user clicks a button
    return new Promise((resolve) => {
      skipResolve = resolve;
    });
  }

  function hidePlaybackError() {
    const errorBox = document.getElementById('mkp-error-box');
    const actionsBox = document.getElementById('mkp-playback-actions-box');
    if (errorBox) errorBox.style.display = 'none';
    if (actionsBox) actionsBox.style.display = 'block';
    skipResolve = null;
  }

  // ========== INJECT STYLES ==========

  function injectStyles() {
    if (document.getElementById('mkp-recorder-styles')) return;

    const style = document.createElement('style');
    style.id = 'mkp-recorder-styles';
    style.textContent = `
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
    if (e.target.closest('#mkp-playback-overlay')) return;

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
    if (e.target.closest('#mkp-playback-overlay')) return;

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
        updatePlaybackOverlay(message.current, message.total, message.command);
        sendResponse({ success: true });
        break;
      case 'SET_PLAYBACK_UI_STATE':
        try {
          if (message.status) setPlaybackUiStatus(message.status);
        } catch (e) {}
        sendResponse({ success: true });
        break;
      case 'SHOW_PLAYBACK_ERROR':
        showPlaybackError(message.error).then(action => {
          sendResponse({ success: true, action: action });
        });
        return true; // Keep channel open for async
      case 'HIDE_PLAYBACK_ERROR':
        hidePlaybackError();
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
        if (!el) throw new Error(`Élément non trouvé: ${target.substring(0, 50)}`);
        
        try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
        highlightElement(el);
        
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
        if (!el) throw new Error(`Élément non trouvé: ${target.substring(0, 50)}`);
        
        try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
        highlightElement(el);
        focusIfEditable(el);
        
        // Vider le champ
        el.value = '';
        
        // Pour les champs sensibles, simuler une saisie progressive
        if (target.includes('zipcode') || target.includes('code-postal') || target.includes('postal-code') || 
            target.includes('first-name') || target.includes('surname') || target.includes('last-name')) {
            // Simuler la saisie caractère par caractère
            for (let i = 0; i < value.length; i++) {
                const char = value[i];
                el.value += char;
                
                // Déclencher les événements pour chaque caractère
                el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
                el.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
                el.dispatchEvent(new Event('input', { bubbles: true }));
                
                // Petit délai entre chaque caractère
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Déclencher les événements finaux
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
            
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
        
        highlightElement(el);
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
        highlightElement(el);
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true };
      }

      case 'uncheck': {
        const el = findElementWithFallback(target, targets);
        if (!el) throw new Error(`Élément non trouvé: ${target.substring(0, 50)}`);
        highlightElement(el);
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

      case 'refresh':
        window.location.reload();
        return { success: true };

      default:
        throw new Error(`Commande non supportée: ${command}`);
    }
  }

  console.log('MKP Auto Recorder content script v2.1 loaded');
})();
