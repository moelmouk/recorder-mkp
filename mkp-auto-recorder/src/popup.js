/**
 * MKP Auto Recorder - Popup Script v2.1
 * With scenario/group reassignment, playback overlay, and command disable
 */

// ==================== DOM ELEMENTS ====================

const elements = {
  // Tabs
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  
  // Paste Scenario Modal
  btnPasteScenario: document.getElementById('btnPasteScenario'),
  pasteModal: document.getElementById('pasteModal'),
  closePasteModal: document.getElementById('closePasteModal'),
  cancelPaste: document.getElementById('cancelPaste'),
  confirmPaste: document.getElementById('confirmPaste'),
  scenarioJson: document.getElementById('scenarioJson'),
  pasteGroup: document.getElementById('pasteGroup'),
  pasteError: document.getElementById('pasteError'),
  btnSidePanel: document.getElementById('btnSidePanel'),
  btnSettings: document.getElementById('btnSettings'),
  btnHelp: document.getElementById('btnHelp'),
  helpModal: document.getElementById('helpModal'),
  helpClose: document.getElementById('helpClose'),
  helpCloseBtn: document.getElementById('helpCloseBtn'),
  
  // Source Code Modal
  sourceModal: document.getElementById('sourceModal'),
  sourceClose: document.getElementById('sourceClose'),
  sourceCloseBtn: document.getElementById('sourceCloseBtn'),
  sourceJson: document.getElementById('sourceJson'),
  sourceCopy: document.getElementById('sourceCopy'),
  sourceJsonEditor: document.getElementById('sourceJsonEditor'),
  sourceSave: document.getElementById('sourceSave'),
  sourceError: document.getElementById('sourceError'),
  
  // Recorder Tab
  statusBar: document.getElementById('statusBar'),
  btnShowSource: document.getElementById('btnShowSource'),
  saveScenarioFields: document.getElementById('saveScenarioFields'),
  scenarioName: document.getElementById('scenarioName'),
  scenarioGroup: document.getElementById('scenarioGroup'),
  appendRecording: document.getElementById('appendRecording'),
  btnStart: document.getElementById('btnStart'),
  btnStop: document.getElementById('btnStop'),
  btnPlay: document.getElementById('btnPlay'),
  btnPlayAll: document.getElementById('btnPlayAll'),
  btnSave: document.getElementById('btnSave'),
  btnClear: document.getElementById('btnClear'),
  btnAddCommand: document.getElementById('btnAddCommand'),
  commandsList: document.getElementById('commandsList'),
  commandCount: document.getElementById('commandCount'),
  
  // Scenarios Tab
  searchScenarios: document.getElementById('searchScenarios'),
  filterGroup: document.getElementById('filterGroup'),
  scenariosList: document.getElementById('scenariosList'),
  btnImport: document.getElementById('btnImport'),
  btnExportAll: document.getElementById('btnExportAll'),
  fileImport: document.getElementById('fileImport'),
  
  // Groups Tab
  newGroupName: document.getElementById('newGroupName'),
  btnAddGroup: document.getElementById('btnAddGroup'),
  groupsList: document.getElementById('groupsList'),
  
  // Edit Command Modal
  editModal: document.getElementById('editModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  modalClose: document.getElementById('modalClose'),
  modalCancel: document.getElementById('modalCancel'),
  modalSave: document.getElementById('modalSave'),
  
  // Edit Scenario Modal
  editScenarioModal: document.getElementById('editScenarioModal'),
  editScenarioName: document.getElementById('editScenarioName'),
  editScenarioGroup: document.getElementById('editScenarioGroup'),
  editScenarioClose: document.getElementById('editScenarioClose'),
  editScenarioCancel: document.getElementById('editScenarioCancel'),
  editScenarioSave: document.getElementById('editScenarioSave'),
  
  // Group Play Modal
  groupPlayModal: document.getElementById('groupPlayModal'),
  groupScenariosList: document.getElementById('groupScenariosList'),
  useRealTiming: document.getElementById('useRealTiming'),
  groupPlayClose: document.getElementById('groupPlayClose'),
  groupPlayCancel: document.getElementById('groupPlayCancel'),
  groupPlayStart: document.getElementById('groupPlayStart'),

  // Settings Modal
  settingsModal: document.getElementById('settingsModal'),
  settingsClose: document.getElementById('settingsClose'),
  settingsCancel: document.getElementById('settingsCancel'),
  backupOutput: document.getElementById('backupOutput'),
  backupInput: document.getElementById('backupInput'),
  btnGenerateBackup: document.getElementById('btnGenerateBackup'),
  btnCopyBackup: document.getElementById('btnCopyBackup'),
  btnDownloadBackup: document.getElementById('btnDownloadBackup'),
  btnRestoreBackup: document.getElementById('btnRestoreBackup'),
  btnLoadBackupFile: document.getElementById('btnLoadBackupFile'),
  backupFileInput: document.getElementById('backupFileInput'),
  settingsTabBtns: document.querySelectorAll('#settingsTabNav .modal-tab-btn'),
  settingsTabPanes: document.querySelectorAll('#settingsModal .modal-tab-pane'),
  themeSelect: document.getElementById('themeSelect'),
  playbackModeSelect: document.getElementById('playbackModeSelect'),

  logLevelFilter: document.getElementById('logLevelFilter'),
  logSearch: document.getElementById('logSearch'),
  btnRefreshLogs: document.getElementById('btnRefreshLogs'),
  btnExportLogs: document.getElementById('btnExportLogs'),
  btnClearLogs: document.getElementById('btnClearLogs'),
  logsList: document.getElementById('logsList')
};

function applyTheme(theme) {
  const t = (theme === 'dark') ? 'dark' : 'light';
  document.body.setAttribute('data-theme', t);
  if (elements.themeSelect) elements.themeSelect.value = t;
}

async function loadTheme() {
  try {
    const result = await chrome.storage.local.get(['mkpTheme']);
    const theme = result && result.mkpTheme ? result.mkpTheme : 'light';
    applyTheme(theme);
  } catch (e) {
    applyTheme('light');
  }
}

async function saveTheme(theme) {
  const t = (theme === 'dark') ? 'dark' : 'light';
  try {
    await chrome.storage.local.set({ mkpTheme: t });
  } catch (e) {
    // ignore
  }
  applyTheme(t);
}

// ==================== PLAYBACK MODE (RWRT | RAC) ====================
function updatePlayButtonTitle() {
  if (elements.btnPlay) {
    const mode = state.playbackMode === 'RAC' ? 'RAC' : 'RWRT';
    elements.btnPlay.title = mode === 'RAC' ? 'Lire séquentiellement (RAC)' : 'Rejouer le scénario (RWRT)';
  }
}

async function loadPlaybackMode() {
  try {
    const result = await chrome.storage.local.get(['mkpPlaybackMode']);
    const mode = result && result.mkpPlaybackMode === 'RAC' ? 'RAC' : 'RWRT';
    state.playbackMode = mode;
    if (elements.playbackModeSelect) elements.playbackModeSelect.value = mode;
  } catch (e) {
    state.playbackMode = 'RWRT';
  }
  updatePlayButtonTitle();
}

async function savePlaybackMode(mode) {
  const m = mode === 'RAC' ? 'RAC' : 'RWRT';
  try {
    await chrome.storage.local.set({ mkpPlaybackMode: m });
  } catch (e) {
    // ignore
  }
  state.playbackMode = m;
  if (elements.playbackModeSelect) elements.playbackModeSelect.value = m;
  updatePlayButtonTitle();
}

function setSettingsTab(tabId) {
  const id = (tabId === 'configuration') ? 'configuration' : 'backup';
  elements.settingsTabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  elements.settingsTabPanes.forEach(p => p.classList.toggle('active', p.id === `settings-tab-${id}`));
}

function initSettingsTabs() {
  elements.settingsTabBtns.forEach(btn => {
    btn.addEventListener('click', () => setSettingsTab(btn.dataset.tab));
  });
}

// ==================== STATE ====================

const state = {
  currentScenario: createEmptyScenario(),
  scenarios: [],
  groups: [],
  expandedGroups: {},
  expandedFolders: new Set(),
  recorderState: {
    isRecording: false,
    tabId: null,
    commands: []
  },
  editingCommandIndex: -1,
  editingScenarioId: null,
  playingGroupId: null,
  // Order of scenario IDs currently being played in a group
  groupPlaybackOrderIds: [],
  // Currently highlighted playing scenario id (for Groups tab UI)
  currentPlayingScenarioId: null,
  logs: [],
  isPlaying: false,
  playbackMode: 'RWRT'
};

function createEmptyScenario() {
  return {
    id: generateId(),
    Name: 'Nouveau scénario',
    CreationDate: new Date().toISOString().split('T')[0],
    groupId: '',
    Commands: []
  };
}

// Build a clean JSON representation of the current scenario
function buildCurrentScenarioJson() {
  const scenario = state.currentScenario || createEmptyScenario();
  const rawCommands = Array.isArray(scenario.Commands) ? scenario.Commands : [];

  const commands = rawCommands
    .filter(cmd => !cmd?.disabled)
    .map(cmd => {
      const out = {
        Command: cmd.Command || '',
        Target: cmd.Target || ''
      };
      if (cmd.Value) out.Value = cmd.Value;
      if (typeof cmd.timing === 'number') out.timing = cmd.timing;
      return out;
    });

  return {
    Name: scenario.Name || 'Scénario',
    CreationDate: scenario.CreationDate || new Date().toISOString().split('T')[0],
    Commands: commands
  };
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ==================== TAB NAVIGATION ====================

elements.tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.tab;
    
    elements.tabBtns.forEach(b => b.classList.remove('active'));
    elements.tabPanes.forEach(p => p.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    if (tabId === 'scenarios') refreshScenariosList();
    if (tabId === 'groups') refreshGroupsList();
    if (tabId === 'logs') refreshLogs();
  });
});

async function logEvent({ level = 'info', category = 'general', action = '', message = '', data = null } = {}) {
  try {
    // Récupérer l'ID du scénario actif s'il existe
    const scenarioData = {
      scenarioId: state.currentScenario?.id || null,
      scenarioName: state.currentScenario?.name || null,
      scenarioGroup: state.currentScenario?.groupId ? 
        (state.groups.find(g => g.id === state.currentScenario.groupId)?.name || state.currentScenario.groupId) : 
        null
    };

    await chrome.runtime.sendMessage({
      type: 'LOG_EVENT',
      level,
      category,
      action,
      message,
      data: {
        ...(data || {}),
        _scenario: scenarioData.scenarioId ? scenarioData : undefined
      }
    });
  } catch (e) {
    console.error('Error logging event:', e);
  }
}

function formatLogTs(ts) {
  try {
    return new Date(ts).toLocaleString('fr-FR', { hour12: false });
  } catch (e) {
    return '';
  }
}

function getFilteredLogs() {
  const logs = Array.isArray(state.logs) ? state.logs : [];
  const level = elements.logLevelFilter ? elements.logLevelFilter.value : '';
  const q = elements.logSearch ? elements.logSearch.value.trim().toLowerCase() : '';

  return logs
    .filter(l => {
      if (level && l.level !== level) return false;
      if (!q) return true;
      const hay = `${l.message || ''} ${l.action || ''} ${l.category || ''}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

function formatErrorMessage(message) {
  // Détecter les messages d'erreur de type "Élément non trouvé"
  const elementNotFoundMatch = message.match(/Élément non trouvé: (id|class|css|xpath|name|link|partialLink|tagName)=(.+)/i);
  if (elementNotFoundMatch) {
    const [, selectorType, selectorValue] = elementNotFoundMatch;
    return `
      <div class="error-message">
        <div class="error-type">Élément non trouvé</div>
        <div class="error-selector">
          <span class="selector-type">${escapeHtml(selectorType)}</span>
          <span class="selector-value">${escapeHtml(selectorValue)}</span>
        </div>
      </div>
    `;
  }

  // Détecter les erreurs d'exécution de commande
  const commandErrorMatch = message.match(/Error executing command (\d+):\s*(.+)/i);
  if (commandErrorMatch) {
    const [, commandId, errorMessage] = commandErrorMatch;
    return `
      <div class="error-message">
        <div class="error-type">Erreur d'exécution</div>
        <div class="error-command">
          <span class="command-id">Commande #${escapeHtml(commandId)}</span>
          <span class="command-error">${escapeHtml(errorMessage)}</span>
        </div>
      </div>
    `;
  }

  // Pour les autres types de messages, retourner le message tel quel
  return escapeHtml(message);
}

function renderLogs() {
  if (!elements.logsList) return;

  const logs = getFilteredLogs();
  if (!logs.length) {
    elements.logsList.innerHTML = '<div class="empty-state"><p>Aucun log</p></div>';
    return;
  }

  elements.logsList.innerHTML = logs.map(l => {
    const level = escapeHtml(l.level || 'info');
    const category = escapeHtml(l.category || 'general');
    const message = l.message || l.action || '';
    const formattedMessage = level === 'error' ? formatErrorMessage(message) : escapeHtml(message);
    const ts = escapeHtml(formatLogTs(l.ts));
    
    // Extraire les informations du scénario si disponibles
    const scenarioInfo = l.data?._scenario;
    const hasScenarioInfo = scenarioInfo && (scenarioInfo.scenarioId || scenarioInfo.scenarioName);
    
    // Formater les données en excluant les métadonnées internes
    const logData = l.data ? { ...l.data } : {};
    delete logData._scenario; // Ne pas afficher les métadonnées du scénario dans le JSON
    
    const data = Object.keys(logData).length > 0 ? JSON.stringify(logData, null, 2) : '';
    const formattedData = data ? 
      `<pre class="log-data">${escapeHtml(data)}</pre>` : '';

    return `
      <div class="log-item" data-level="${level}">
        <div class="log-item-header">
          <span class="log-ts">${ts}</span>
          <span class="log-pill log-pill-${level}">${level}</span>
          <span class="log-cat">${category}</span>
          ${hasScenarioInfo ? `
            <div class="log-scenario">
              <span class="log-scenario-label">Scénario:</span>
              ${scenarioInfo.scenarioName ? 
                `<span class="log-scenario-name">${escapeHtml(scenarioInfo.scenarioName)}</span>` : 
                `<span class="log-scenario-id">${escapeHtml(scenarioInfo.scenarioId)}</span>`}
              ${scenarioInfo.scenarioGroup ? 
                `<span class="log-scenario-group">(${escapeHtml(scenarioInfo.scenarioGroup)})</span>` : ''}
            </div>
          ` : ''}
        </div>
        <div class="log-message">${formattedMessage}</div>
        ${formattedData}
      </div>
    `;
  }).join('');
}

async function refreshLogs() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'GET_LOGS' });
    state.logs = resp && Array.isArray(resp.logs) ? resp.logs : [];
  } catch (e) {
    state.logs = [];
  }
  renderLogs();
}

function exportLogs() {
  const logs = getFilteredLogs();
  const dataStr = JSON.stringify(logs, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mkp-logs-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function clearLogs() {
  try {
    await chrome.runtime.sendMessage({ type: 'CLEAR_LOGS' });
    await refreshLogs();
  } catch (e) {
    // ignore
  }
}

if (elements.btnSidePanel) {
  elements.btnSidePanel.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      showStatus('error', 'Aucun onglet actif');
      return;
    }

    if (!chrome.sidePanel || typeof chrome.sidePanel.open !== 'function') {
      showStatus('error', 'Side panel non supporté sur cette version de Chrome');
      return;
    }

    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (e) {
      showStatus('error', e && e.message ? e.message : 'Impossible d’ouvrir le side panel');
    }
  });
}

// ==================== STORAGE ====================

async function loadData() {
  const result = await chrome.storage.local.get(['mkpScenarios', 'mkpGroups']);
  state.scenarios = result.mkpScenarios || [];
  state.groups = result.mkpGroups || [];
  updateGroupSelects();
}

async function saveData() {
  await chrome.storage.local.set({
    mkpScenarios: state.scenarios,
    mkpGroups: state.groups
  });
}

// ==================== RECORDING ====================

elements.btnStart.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    showStatus('error', 'Impossible de démarrer');
    return;
  }

  const append = !!(elements.appendRecording && elements.appendRecording.checked);

  if (!append) {
    state.currentScenario = createEmptyScenario();
    state.currentScenario.Name = elements.scenarioName.value || 'Nouveau scénario';
    state.currentScenario.groupId = elements.scenarioGroup.value;

    await chrome.runtime.sendMessage({ type: 'CLEAR_SCENARIO' });
  } else {
    state.currentScenario.Name = elements.scenarioName.value || state.currentScenario.Name || 'Nouveau scénario';
    state.currentScenario.groupId = elements.scenarioGroup.value;
    await syncToBackground();
  }

  await chrome.runtime.sendMessage({ type: 'START_RECORDING', tabId: tab.id, append: append });
  logEvent({
    level: 'info',
    category: 'recording',
    action: 'start',
    message: 'Démarrage enregistrement (popup)',
    data: { tabId: tab.id, scenarioName: state.currentScenario.Name, append: append }
  });
  
  state.isRecording = true;
  updateUIState();
  startPolling();
});

if (elements.btnAddCommand) {
  elements.btnAddCommand.addEventListener('click', () => {
    const newCmd = {
      Command: 'click',
      Target: '',
      Value: '',
      Description: '',
      Targets: [],
      timing: 0,
      timestamp: Date.now(),
      disabled: false
    };

    state.currentScenario.Commands.push(newCmd);
    renderCommands();
    syncToBackground();

    editCommand(state.currentScenario.Commands.length - 1);
  });
}

elements.btnStop.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.runtime.sendMessage({ type: 'STOP_RECORDING', tabId: tab ? tab.id : null });
  logEvent({ level: 'info', category: 'recording', action: 'stop', message: 'Arrêt enregistrement (popup)', data: { tabId: tab ? tab.id : null } });
  
  state.isRecording = false;
  updateUIState();
  stopPolling();
  await loadCurrentScenario();
});

// ==================== PLAYBACK ====================

function waitMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeAllCommands() {
  if (state.isPlaying) return;

  const commands = Array.isArray(state.currentScenario?.Commands) ? state.currentScenario.Commands : [];
  if (commands.length === 0) return;

  // Work only with enabled commands for RAC progression
  const activeIndexes = commands.map((c, idx) => (!c?.disabled ? idx : -1)).filter(i => i >= 0);
  const totalToPlay = activeIndexes.length;
  if (totalToPlay === 0) {
    showStatus('error', 'Aucune action active à lire');
    return;
  }

  state.isPlaying = true;
  showStatus('playing', 'Lecture séquentielle en cours...');
  resetCommandProgress();

  if (elements.btnPlayAll) elements.btnPlayAll.disabled = true;
  if (elements.btnPlay) elements.btnPlay.disabled = true;
  if (elements.btnStart) elements.btnStart.disabled = true;

  // Determine active tab and open playback overlay via background
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;
  try {
    await chrome.runtime.sendMessage({ type: 'RAC_START', tabId, total: totalToPlay });
  } catch (e) {
    console.warn('RAC_START error (overlay may not appear):', e);
  }

  let aborted = false;
  try {
    for (let playedCount = 0; playedCount < totalToPlay; playedCount++) {
      const cmdIndex = activeIndexes[playedCount];
      const cmd = commands[cmdIndex];

      // Handle pause/stop via background playback state
      while (true) {
        let st;
        try {
          const resp = await chrome.runtime.sendMessage({ type: 'GET_PLAYBACK_STATE' });
          st = resp?.state;
        } catch (e) {
          st = null;
        }
        const status = st?.status || 'playing';
        if (status === 'stopped') { aborted = true; break; }
        if (status === 'paused') { await waitMs(200); continue; }
        break; // playing
      }
      if (aborted) break;

      // Update overlay with current progress and next command info
      try {
        await chrome.runtime.sendMessage({
          type: 'RAC_UPDATE',
          current: playedCount,
          total: totalToPlay,
          command: cmd?.Command || '',
          delay: 0
        });
      } catch {}

      // Update popup progress and status
      updateGlobalProgress(playedCount + 1, totalToPlay);
      showStatus('playing', `Lecture ${playedCount + 1}/${totalToPlay}...`);

      // Execute the command
      await executeSingleCommand(cmdIndex, { bypassPlayingGuard: true });

      // Small spacing delay between commands (kept from previous behavior)
      await waitMs(500);
    }

    if (!aborted) {
      updateGlobalProgress(totalToPlay, totalToPlay);
      showStatus('success', 'Lecture séquentielle terminée');
    } else {
      showStatus('error', 'Lecture arrêtée');
    }
  } finally {
    // Close overlay if we finished normally; if user stopped, background already hid it via STOP_PLAYBACK
    if (!aborted) {
      try { await chrome.runtime.sendMessage({ type: 'RAC_END' }); } catch {}
    }

    state.isPlaying = false;
    if (elements.btnPlayAll) elements.btnPlayAll.disabled = state.currentScenario.Commands.length === 0;
    if (elements.btnPlay) elements.btnPlay.disabled = state.currentScenario.Commands.length === 0;
    if (elements.btnStart) elements.btnStart.disabled = false;
    clearCommandHighlight();
  }
}

elements.btnPlay.addEventListener('click', async () => {
  // If playback mode is RAC (Read All Commands), run sequential executor and return
  if (state.playbackMode === 'RAC') {
    await executeAllCommands();
    return;
  }

  // Default RWRT (Read With Real Time) behavior
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    showStatus('error', 'Impossible de lancer');
    return;
  }

  // Filter out disabled commands
  const scenarioToPlay = {
    ...state.currentScenario,
    Commands: state.currentScenario.Commands.filter(cmd => !cmd.disabled)
  };

  await chrome.runtime.sendMessage({
    type: 'SET_SCENARIO',
    scenario: scenarioToPlay
  });

  showStatus('playing', 'Lecture en cours...');
  elements.btnPlay.disabled = true;
  elements.btnStart.disabled = true;

  await chrome.runtime.sendMessage({
    type: 'PLAY_SCENARIO',
    tabId: tab.id,
    useRealTiming: true
  });

  logEvent({
    level: 'info',
    category: 'playback',
    action: 'play_scenario',
    message: 'Lecture scénario (popup)',
    data: { tabId: tab.id, commands: scenarioToPlay.Commands.length, useRealTiming: true }
  });

  pollPlaybackState();
});

if (elements.btnPlayAll) {
  elements.btnPlayAll.addEventListener('click', async () => {
    await executeAllCommands();
  });
}

function updateGlobalProgress(currentIndex, totalCommands) {
  const progressBar = document.getElementById('commandProgress');
  const timeDisplay = document.getElementById('commandTime');
  
  if (!progressBar || !timeDisplay) return;
  
  // Calculer le pourcentage de progression global
  const progress = totalCommands > 0 ? Math.round((currentIndex / totalCommands) * 100) : 0;
  progressBar.style.setProperty('--progress', `${progress}%`);
  
  // Mettre à jour le texte pour afficher la progression (ex: "3/10")
  timeDisplay.textContent = `${currentIndex}/${totalCommands}`;
  
  // Changer la couleur quand on approche de la fin
  if (currentIndex >= totalCommands * 0.9) {
    progressBar.classList.add('ending-soon');
  } else {
    progressBar.classList.remove('ending-soon');
  }
}

function resetCommandProgress() {
  const progressBar = document.getElementById('commandProgress');
  const timeDisplay = document.getElementById('commandTime');
  
  if (progressBar) {
    progressBar.style.setProperty('--progress', '0%');
    progressBar.classList.remove('ending-soon');
  }
  
  if (timeDisplay) {
    timeDisplay.textContent = '0/0';
  }
}

function pollPlaybackState() {
  const interval = setInterval(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'GET_PLAYBACK_STATE' });
    const st = response.state;

    if (st.status === 'playing') {
      // Mettre à jour la progression globale
      updateGlobalProgress(st.currentIndex + 1, st.total);
      
      // Mettre à jour le statut
      showStatus('playing', `Lecture ${st.currentIndex + 1}/${st.total}...`);
      highlightCommand(st.currentIndex);
      setCommandErrors(st.errorIndexes);
      
    } else if (st.status === 'completed') {
      clearInterval(interval);
      // Mettre la barre à 100% à la fin
      updateGlobalProgress(st.total, st.total);
      showStatus('success', 'Lecture terminée');
      showToast(`Scénario "${(elements.scenarioName && elements.scenarioName.value) ? elements.scenarioName.value : 'Nouveau scénario'}" terminé sans erreur`, 'success');
      elements.btnPlay.disabled = false;
      elements.btnStart.disabled = false;
      clearCommandHighlight();
      setCommandErrors(st.errorIndexes);
      
    } else if (st.status === 'error' || st.status === 'stopped') {
      clearInterval(interval);
      showStatus('error', st.error || 'Arrêté');
      elements.btnPlay.disabled = false;
      elements.btnStart.disabled = false;
      clearCommandHighlight();
      setCommandErrors(st.errorIndexes);
      
    } else if (st.status === 'skipped') {
      // Mettre à jour la progression même pour les commandes ignorées
      updateGlobalProgress(st.currentIndex + 1, st.total);
      showStatus('playing', `Étape ignorée, continuation...`);
    }
  }, 200);
}

// ==================== SAVE/CLEAR ====================

elements.btnSave.addEventListener('click', async () => {
  const savePanel = elements.saveScenarioFields || document.getElementById('saveScenarioFields');

  if (savePanel && savePanel.style.display === 'none') {
    if (elements.scenarioName) {
      elements.scenarioName.value = state.currentScenario?.Name || elements.scenarioName.value || 'Nouveau scénario';
    }
    if (elements.scenarioGroup) {
      elements.scenarioGroup.value = state.currentScenario?.groupId || elements.scenarioGroup.value || '';
    }

    savePanel.style.display = 'block';
    try {
      elements.scenarioName && elements.scenarioName.focus && elements.scenarioName.focus();
      elements.scenarioName && elements.scenarioName.select && elements.scenarioName.select();
    } catch (e) {}
    return;
  }

  if (state.currentScenario.Commands.length === 0) {
    showStatus('error', 'Aucune action à sauvegarder');
    return;
  }

  state.currentScenario.Name = elements.scenarioName.value || 'Nouveau scénario';
  state.currentScenario.groupId = elements.scenarioGroup.value;
  state.currentScenario.CreationDate = new Date().toISOString().split('T')[0];

  const existingIndex = state.scenarios.findIndex(s => s.id === state.currentScenario.id);
  if (existingIndex >= 0) {
    state.scenarios[existingIndex] = { ...state.currentScenario };
  } else {
    state.scenarios.push({ ...state.currentScenario });
  }

  await saveData();
  showStatus('success', 'Scénario sauvegardé');

  if (savePanel) {
    savePanel.style.display = 'none';
  }
});

elements.btnClear.addEventListener('click', async () => {
  if (state.currentScenario.Commands.length > 0 && !confirm('Effacer le scénario actuel ?')) {
    return;
  }

  await chrome.runtime.sendMessage({ type: 'CLEAR_SCENARIO' });
  state.currentScenario = createEmptyScenario();
  elements.scenarioName.value = state.currentScenario.Name;
  renderCommands();
  showStatus('', 'Prêt à enregistrer');
});

// ==================== COMMANDS RENDERING ====================

function renderCommands() {
  const commands = state.currentScenario.Commands;
  // Mettre à jour le compteur de commandes
  if (elements.commandCount) {
    elements.commandCount.textContent = commands.length;
  }

  if (commands.length === 0) {
    elements.commandsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <path d="M14 2v6h6"></path>
            <path d="M16 13H8"></path>
            <path d="M16 17H8"></path>
            <path d="M10 9H8"></path>
          </svg>
        </span>
        <p>Aucune action enregistrée</p>
      </div>
    `;
    elements.btnPlay.disabled = true;
    if (elements.btnPlayAll) elements.btnPlayAll.disabled = true;
    return;
  }

  elements.btnPlay.disabled = false;
  if (elements.btnPlayAll) elements.btnPlayAll.disabled = false;

  const html = commands.map((cmd, index) => {
    const timing = cmd.timing ? `${(cmd.timing / 1000).toFixed(1)}s` : '';
    const targetShort = (cmd.Target || '').substring(0, 45);
    const isDisabled = cmd.disabled;
    const disabledClass = isDisabled ? 'command-disabled' : '';
    const disabledIcon = isDisabled ? '🔇' : '🔊';
    const disabledTitle = isDisabled ? 'Activer' : 'Désactiver';
    
    return `
      <div class="command-item ${disabledClass}" data-index="${index}">
        <span class="command-number">${index + 1}</span>
        <div class="command-info">
          <span class="command-type">${escapeHtml(cmd.Command)}</span>
          ${isDisabled ? '<span class="command-badge-disabled">IGNORÉ</span>' : ''}
          <div class="command-target" title="${escapeHtml(cmd.Target)}">${escapeHtml(targetShort)}</div>
          ${timing ? `<div class="command-timing"><span class="inline-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 3"></path></svg></span>${timing}</div>` : ''}
          ${cmd.Value ? `<div class="command-timing"><span class="inline-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4z"></path><path d="M13.5 6.5l4 4"></path></svg></span>${escapeHtml(cmd.Value.substring(0, 25))}</div>` : ''}
        </div>
        <div class="command-actions">
          <button class="cmd-icon-btn btn-play" data-index="${index}" title="Exécuter cette commande" aria-label="Jouer">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
          <button class="cmd-icon-btn btn-locate" data-index="${index}" title="Localiser l'élément" aria-label="Localiser">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="7"></circle>
              <circle cx="12" cy="12" r="2"></circle>
            </svg>
          </button>
          <button class="cmd-icon-btn btn-toggle" data-index="${index}" title="${disabledTitle}" aria-label="Activer/Désactiver">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"></path>
              <circle cx="12" cy="12" r="3"></circle>
              ${isDisabled ? '<line x1="4" y1="4" x2="20" y2="20"></line>' : ''}
            </svg>
          </button>
          <button class="cmd-icon-btn btn-edit" data-index="${index}" title="Modifier" aria-label="Modifier">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
            </svg>
          </button>
          <button class="cmd-icon-btn btn-delete" data-index="${index}" title="Supprimer" aria-label="Supprimer">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  elements.commandsList.innerHTML = html;

  // Event listeners
  elements.commandsList.querySelectorAll('.btn-locate').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await locateCommand(parseInt(btn.dataset.index));
    });
  });

  elements.commandsList.querySelectorAll('.btn-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCommand(parseInt(btn.dataset.index));
    });
  });

  elements.commandsList.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editCommand(parseInt(btn.dataset.index));
    });
  });

  elements.commandsList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCommand(parseInt(btn.dataset.index));
    });
  });

  elements.commandsList.scrollTop = elements.commandsList.scrollHeight;
}

async function locateCommand(index) {
  const cmd = state.currentScenario.Commands[index];
  if (!cmd || !cmd.Target) {
    showToast('Target manquant pour cette action', 'error');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    showToast('Aucun onglet actif', 'error');
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content_script.js']
    });
  } catch (e) {
    // ignore
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'HIGHLIGHT_TARGET',
      target: cmd.Target,
      targets: cmd.Targets || []
    });

    if (response && response.success) return;
    showToast((response && response.error) ? response.error : 'Élément introuvable', 'error');
  } catch (e) {
    showToast(e && e.message ? e.message : 'Impossible de contacter la page', 'error');
  }
}

function highlightCommand(index) {
  const commandItems = elements.commandsList.querySelectorAll('.command-item');
  commandItems.forEach((item, i) => {
    item.classList.toggle('active', i === index);
  });

  // Faire défiler pour afficher la commande active
  if (commandItems[index]) {
    const container = elements.commandsList;
    const item = commandItems[index];
    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    
    // Vérifier si l'élément est partiellement ou totalement en dehors de la vue
    if (itemRect.top < containerRect.top + container.scrollTop) {
      // Faire défiler vers le haut pour afficher l'élément
      container.scrollTop = container.scrollTop - (containerRect.top - itemRect.top) - 10; // 10px de marge
    } else if (itemRect.bottom > containerRect.bottom) {
      // Faire défiler vers le bas pour afficher l'élément
      container.scrollTop = container.scrollTop + (itemRect.bottom - containerRect.bottom) + 10; // 10px de marge
    }
  }
}

function setCommandErrors(errorIndexes) {
  const normalized = Array.isArray(errorIndexes) ? errorIndexes : [];
  const errorSet = new Set(normalized);

  const commandItems = elements.commandsList.querySelectorAll('.command-item');
  commandItems.forEach((item, i) => {
    item.classList.toggle('error', errorSet.has(i));
  });
}

function clearCommandHighlight() {
  elements.commandsList.querySelectorAll('.command-item').forEach(item => {
    item.classList.remove('active');
  });
}

// ==================== TOGGLE COMMAND (DISABLE/ENABLE) ====================

function toggleCommand(index) {
  // Sauvegarder la position de défilement actuelle
  const commandsList = document.getElementById('commandsList');
  const scrollPosition = commandsList.scrollTop;
  const commandElement = commandsList.querySelector(`[data-index="${index}"]`);
  const commandRect = commandElement ? commandElement.getBoundingClientRect() : null;
  const commandsListRect = commandsList.getBoundingClientRect();
  const isCommandInView = commandRect && (
    commandRect.top >= commandsListRect.top &&
    commandRect.bottom <= commandsListRect.bottom
  );

  // Basculer l'état de la commande
  const cmd = state.currentScenario.Commands[index];
  if (!cmd) return;
  
  cmd.disabled = !cmd.disabled;
  
  // Sauvegarder les changements
  syncToBackground();
  
  // Mettre à jour l'interface utilisateur
  renderCommands();

  // Restaurer la position de défilement si nécessaire
  if (isCommandInView) {
    // Attendre que le rendu soit terminé
    setTimeout(() => {
      const newCommandElement = commandsList.querySelector(`[data-index="${index}"]`);
      if (newCommandElement) {
        // Vérifier si l'élément est toujours visible après le rendu
        const newCommandRect = newCommandElement.getBoundingClientRect();
        const newCommandsListRect = commandsList.getBoundingClientRect();
        
        if (newCommandRect.top < newCommandsListRect.top || 
            newCommandRect.bottom > newCommandsListRect.bottom) {
          // Faire défiler pour ramener l'élément en vue si nécessaire
          newCommandElement.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        }
      }
    }, 0);
  } else {
    // Si l'élément n'était pas visible, restaurer simplement la position de défilement
    commandsList.scrollTop = scrollPosition;
  }
}

// ==================== EDIT COMMAND ====================

function editCommand(index) {
  const cmd = state.currentScenario.Commands[index];
  if (!cmd) return;

  state.editingCommandIndex = index;
  elements.modalTitle.textContent = `Modifier l'action #${index + 1}`;
  
  elements.modalBody.innerHTML = `
    <div class="form-group">
      <label>Commande</label>
      <select id="editCommand">
        <option value="click" ${cmd.Command === 'click' ? 'selected' : ''}>click</option>
        <option value="type" ${cmd.Command === 'type' ? 'selected' : ''}>type</option>
        <option value="select" ${cmd.Command === 'select' ? 'selected' : ''}>select</option>
        <option value="check" ${cmd.Command === 'check' ? 'selected' : ''}>check</option>
        <option value="uncheck" ${cmd.Command === 'uncheck' ? 'selected' : ''}>uncheck</option>
        <option value="pause" ${cmd.Command === 'pause' ? 'selected' : ''}>pause</option>
        <option value="open" ${cmd.Command === 'open' ? 'selected' : ''}>open</option>
        <option value="waitForVisible" ${cmd.Command === 'waitForVisible' ? 'selected' : ''}>waitForVisible</option>
      </select>
    </div>
    <div class="form-group">
      <label>Target</label>
      <textarea id="editTarget" rows="3">${escapeHtml(cmd.Target || '')}</textarea>
    </div>
    <div class="form-group">
      <label>Valeur</label>
      <input type="text" id="editValue" value="${escapeHtml(cmd.Value || '')}">
    </div>
    <div class="form-group">
      <label>Délai avant (ms)</label>
      <input type="number" id="editTiming" value="${cmd.timing || 0}" min="0" step="100">
    </div>
    <div class="form-group">
      <label>
        <input type="checkbox" id="editDisabled" ${cmd.disabled ? 'checked' : ''}>
        Désactiver cette action (ignorée lors de la lecture)
      </label>
    </div>
  `;

  elements.editModal.classList.add('active');
}

function deleteCommand(index) {
  if (!confirm(`Supprimer l'action #${index + 1} ?`)) return;
  
  state.currentScenario.Commands.splice(index, 1);
  renderCommands();
  syncToBackground();
}

// Modal events
elements.modalClose.addEventListener('click', closeModal);
elements.modalCancel.addEventListener('click', closeModal);

elements.modalSave.addEventListener('click', () => {
  if (state.editingCommandIndex >= 0) {
    const cmd = state.currentScenario.Commands[state.editingCommandIndex];
    cmd.Command = document.getElementById('editCommand').value;
    cmd.Target = document.getElementById('editTarget').value;
    cmd.Value = document.getElementById('editValue').value;
    cmd.timing = parseInt(document.getElementById('editTiming').value) || 0;
    cmd.disabled = document.getElementById('editDisabled').checked;
    
    renderCommands();
    syncToBackground();
  }
  closeModal();
});

function closeModal() {
  elements.editModal.classList.remove('active');
  state.editingCommandIndex = -1;
}

// ==================== SCENARIOS LIST ====================

function refreshScenariosList() {
  const search = elements.searchScenarios.value.toLowerCase();
  const groupFilter = elements.filterGroup.value;
  
  let filtered = state.scenarios;
  
  if (search) {
    filtered = filtered.filter(s => s.Name.toLowerCase().includes(search));
  }
  
  if (groupFilter) {
    filtered = filtered.filter(s => s.groupId === groupFilter);
  }

  if (filtered.length === 0) {
    elements.scenariosList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h5l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          </svg>
        </span>
        <p>Aucun scénario trouvé</p>
      </div>
    `;
    return;
  }

  const html = filtered.map(scenario => {
    const group = state.groups.find(g => g.id === scenario.groupId);
    const groupName = group ? group.name : 'Sans groupe';
    const disabledCount = scenario.Commands.filter(c => c.disabled).length;
    
    return `
      <div class="scenario-card" data-id="${scenario.id}">
        <div class="scenario-card-header">
          <span class="scenario-name">${escapeHtml(scenario.Name)}</span>
          <span class="scenario-badge">${escapeHtml(groupName)}</span>
        </div>
        <div class="scenario-meta">
          <span><span class="inline-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></span>${scenario.CreationDate}</span>
          <span><span class="inline-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg></span>${scenario.Commands.length} actions</span>
          ${disabledCount > 0 ? `<span><span class="inline-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle><line x1="4" y1="4" x2="20" y2="20"></line></svg></span>${disabledCount} ignorées</span>` : ''}
        </div>
        <div class="scenario-actions">
          <button class="btn btn-xs btn-primary btn-load" data-id="${scenario.id}">Charger</button>
          <button class="cmd-icon-btn btn-edit-scenario" data-id="${scenario.id}" title="Modifier" aria-label="Modifier">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
            </svg>
          </button>
          <button class="cmd-icon-btn btn-duplicate-scenario" data-id="${scenario.id}" title="Dupliquer" aria-label="Dupliquer">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button class="cmd-icon-btn btn-export" data-id="${scenario.id}" title="Exporter" aria-label="Exporter">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </button>
          <button class="cmd-icon-btn btn-delete-scenario" data-id="${scenario.id}" title="Supprimer" aria-label="Supprimer">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  elements.scenariosList.innerHTML = html;

  // Event listeners
  elements.scenariosList.querySelectorAll('.btn-load').forEach(btn => {
    btn.addEventListener('click', () => loadScenario(btn.dataset.id));
  });

  elements.scenariosList.querySelectorAll('.btn-edit-scenario').forEach(btn => {
    btn.addEventListener('click', () => openEditScenarioModal(btn.dataset.id));
  });

  elements.scenariosList.querySelectorAll('.btn-export').forEach(btn => {
    btn.addEventListener('click', () => exportScenario(btn.dataset.id));
  });

  elements.scenariosList.querySelectorAll('.btn-duplicate-scenario').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      duplicateScenario(btn.dataset.id);
    });
  });

  elements.scenariosList.querySelectorAll('.btn-delete-scenario').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteScenario(btn.dataset.id);
    });
  });
}

function loadScenario(id) {
  const scenario = state.scenarios.find(s => s.id === id);
  if (!scenario) return;

  state.currentScenario = JSON.parse(JSON.stringify(scenario));
  elements.scenarioName.value = scenario.Name;
  elements.scenarioGroup.value = scenario.groupId || '';
  
  renderCommands();
  syncToBackground();
  
  document.querySelector('[data-tab="recorder"]').click();
  showStatus('success', 'Scénario chargé');
}

function exportScenario(id) {
  const scenario = state.scenarios.find(s => s.id === id);
  if (!scenario) return;

  const dataStr = JSON.stringify(scenario, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${scenario.Name.replace(/[^a-z0-9]/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function deleteScenario(id) {
  if (!confirm('Supprimer ce scénario ?')) return;

  state.scenarios = state.scenarios.filter(s => s.id !== id);
  await saveData();
  refreshScenariosList();
}

// ==================== DUPLICATE SCENARIO ====================

async function duplicateScenario(id) {
  const scenario = state.scenarios.find(s => s.id === id);
  if (!scenario) return;
  
  // Créer une copie profonde du scénario
  const newScenario = JSON.parse(JSON.stringify(scenario));
  
  // Générer un nouvel ID et mettre à jour le nom
  newScenario.id = generateId();
  newScenario.Name = `${scenario.Name} (copie)`;
  newScenario.CreationDate = new Date().toISOString().split('T')[0];
  
  // Ajouter le nouveau scénario
  state.scenarios.push(newScenario);
  await saveData();
  
  // Mettre à jour l'interface
  refreshScenariosList();
  showToast('Scénario dupliqué avec succès', 'success');
}

// ==================== EDIT SCENARIO (REASSIGN GROUP) ====================

function openEditScenarioModal(id) {
  const scenario = state.scenarios.find(s => s.id === id);
  if (!scenario) return;

  state.editingScenarioId = id;
  elements.editScenarioName.value = scenario.Name;
  
  // Update group select options
  const options = '<option value="">Sans groupe</option>' + 
    state.groups.map(g => `<option value="${g.id}" ${scenario.groupId === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('');
  elements.editScenarioGroup.innerHTML = options;
  
  elements.editScenarioModal.classList.add('active');
}

elements.editScenarioClose.addEventListener('click', closeEditScenarioModal);
elements.editScenarioCancel.addEventListener('click', closeEditScenarioModal);

function closeEditScenarioModal() {
  elements.editScenarioModal.classList.remove('active');
  state.editingScenarioId = null;
}

elements.editScenarioSave.addEventListener('click', async () => {
  if (!state.editingScenarioId) return;

  const scenario = state.scenarios.find(s => s.id === state.editingScenarioId);
  if (!scenario) return;

  scenario.Name = elements.editScenarioName.value || 'Scénario';
  scenario.groupId = elements.editScenarioGroup.value;

  await saveData();
  refreshScenariosList();
  closeEditScenarioModal();
  showStatus('success', 'Scénario modifié');
});

// Search and filter events
elements.searchScenarios.addEventListener('input', refreshScenariosList);
elements.filterGroup.addEventListener('change', refreshScenariosList);

// ==================== IMPORT/EXPORT ====================

elements.btnImport.addEventListener('click', () => {
  elements.fileImport.click();
});

elements.fileImport.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    const scenarios = Array.isArray(imported) ? imported : [imported];
    
    for (const scenario of scenarios) {
      if (!scenario.Commands || !Array.isArray(scenario.Commands)) continue;
      
      scenario.id = generateId();
      scenario.groupId = scenario.groupId || '';
      state.scenarios.push(scenario);
    }

    await saveData();
    refreshScenariosList();
    showStatus('success', `${scenarios.length} scénario(s) importé(s)`);
    logEvent({ level: 'success', category: 'import', action: 'import_scenarios', message: `${scenarios.length} scénario(s) importé(s)`, data: { count: scenarios.length } });
  } catch (error) {
    showStatus('error', 'Erreur import: ' + error.message);
    logEvent({ level: 'error', category: 'import', action: 'import_scenarios', message: 'Erreur import', data: { error: error.message } });
  }

  elements.fileImport.value = '';
});

elements.btnExportAll.addEventListener('click', () => {
  if (state.scenarios.length === 0) {
    showStatus('error', 'Aucun scénario à exporter');
    logEvent({ level: 'warn', category: 'export', action: 'export_all', message: 'Aucun scénario à exporter' });
    return;
  }

  const dataStr = JSON.stringify(state.scenarios, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `mkp_scenarios_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);

  logEvent({ level: 'success', category: 'export', action: 'export_all', message: 'Export scénarios', data: { count: state.scenarios.length } });
});

// ==================== GROUPS ====================

function setupGroupEventListeners() {
  // Gestion du clic sur le bouton de bascule des dossiers
  elements.groupsList.querySelectorAll('.toggle-folder').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFolder(btn.dataset.id);
    });
  });

  // Gestion du clic sur l'en-tête d'un groupe/dossier
  elements.groupsList.querySelectorAll('.group-item-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        const groupId = header.closest('.group-item').dataset.id;
        const group = state.groups.find(g => g.id === groupId);
        if (group && isFolder(group)) {
          toggleFolder(groupId);
        }
      }
    });
  });

  // Gestion du bouton d'ajout de sous-groupe
  elements.groupsList.querySelectorAll('.btn-add-subgroup').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const parentId = btn.dataset.parentId;
      const name = prompt('Nom du nouveau sous-groupe:');
      if (name) {
        await createGroup(name, parentId, true); // Créer un dossier
      }
    });
  });

  // Gestion du bouton de renommage
  elements.groupsList.querySelectorAll('.btn-rename-group').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      renameGroup(btn.dataset.id);
    });
  });

  // Gestion du bouton de suppression
  elements.groupsList.querySelectorAll('.btn-delete-group').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteGroup(btn.dataset.id);
    });
  });

  // Gestion du bouton de lecture du dossier
  elements.groupsList.querySelectorAll('.btn-play-group').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openGroupPlayModal(btn.dataset.id);
    });
  });
}

function renderGroupItem(group, level = 0) {
  const isExpanded = state.expandedFolders.has(group.id);
  const children = getChildGroups(group.id);
  const hasChildren = children.length > 0;
  const isGroupFolder = isFolder(group);
  
  // Fonction pour compter récursivement les scénarios dans un groupe et ses sous-groupes
  const countScenariosInGroup = (groupId) => {
    console.log(`Comptage des scénarios pour le groupe ${groupId}`);
    
    // Compter les scénarios directs dans ce groupe
    const directScenarios = state.scenarios.filter(s => s.groupId === groupId);
    let count = directScenarios.length;
    console.log(`- ${count} scénario(s) direct(s) trouvé(s) dans le groupe ${groupId}`);
    
    // Trouver tous les sous-groupes directs
    const childGroups = state.groups.filter(g => g.parentId === groupId);
    console.log(`- ${childGroups.length} sous-groupe(s) trouvé(s) pour le groupe ${groupId}`);
    
    // Pour chaque sous-groupe, compter récursivement ses scénarios
    for (const child of childGroups) {
      const childCount = countScenariosInGroup(child.id);
      console.log(`- ${childCount} scénario(s) trouvé(s) dans le sous-groupe ${child.id}`);
      count += childCount;
    }
    
    console.log(`Total pour le groupe ${groupId}: ${count} scénario(s)`);
    return count;
  };

  // Récupérer les scénarios de ce groupe
  const groupScenarios = state.scenarios
    .filter(s => s.groupId === group.id)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  
  // Compter les scénarios dans ce groupe et tous ses sous-groupes
  const totalScenarioCount = countScenariosInGroup(group.id);
  const isRootFolder = !group.parentId;
  
  let html = `
    <div class="group-item ${isGroupFolder ? 'folder' : ''}" data-id="${group.id}" data-level="${level}">
      <div class="group-item-header">
        <div style="display: flex; align-items: center; flex-grow: 1;">
          ${hasChildren ? `
            <button class="toggle-folder" data-id="${group.id}" style="margin-right: 8px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="${isExpanded ? '18 15 12 9 6 15' : '9 18 15 12 9 6'}"></polyline>
              </svg>
            </button>
          ` : '<div style="width: 20px;"></div>'}
          
          <span class="group-name">${escapeHtml(group.name)}</span>
          <span class="group-scenario-count" title="${totalScenarioCount} scénario(s)">${totalScenarioCount > 0 ? totalScenarioCount : ''}</span>
        </div>
        
        <div class="group-actions" style="display: flex; gap: 4px;">
          <button class="cmd-icon-btn btn-play-group" data-id="${group.id}" title="${totalScenarioCount > 0 ? 'Lancer tous les scénarios de ' + escapeHtml(group.name) : 'Aucun scénario à lancer'}" ${totalScenarioCount === 0 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : 'style="color: var(--success);"'}>
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
</button>
          
          ${isGroupFolder ? `
            <button class="cmd-icon-btn btn-add-subgroup" data-parent-id="${group.id}" title="Ajouter un sous-groupe">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          ` : ''}
          
          <button class="cmd-icon-btn btn-rename-group" data-id="${group.id}" title="Renommer">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
            </svg>
          </button>
          <button class="cmd-icon-btn btn-delete-group" data-id="${group.id}" title="Supprimer">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
            </svg>
          </button>
        </div>
      </div>
      
      ${(hasChildren || groupScenarios.length > 0) ? `
        <div class="group-children" style="display: ${isExpanded ? 'block' : 'none'};">
          ${groupScenarios.length > 0 ? `
            <div class="scenario-list">
              ${groupScenarios.map(scenario => `
                <div class="scenario-item${state.currentPlayingScenarioId === scenario.id ? ' playing' : ''}" data-id="${scenario.id}">
                  <span class="scenario-name">${escapeHtml(scenario.Name)}</span>
                  <div class="scenario-actions">
                    <button class="cmd-icon-btn btn-load-scenario" data-id="${scenario.id}" title="Charger ce scénario">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                    </button>
                    <button class="cmd-icon-btn btn-edit-scenario" data-id="${scenario.id}" title="Éditer ce scénario">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${hasChildren ? children.map(child => renderGroupItem(child, level + 1)).join('') : ''}
        </div>
      ` : ''}
    </div>
  `;
  
  return html;
}

function refreshGroupsList(searchTerm = '') {
  // Trier les groupes par nom
  const groupsSorted = [...state.groups].sort((a, b) => {
    // D'abord les dossiers, puis les groupes
    if (isFolder(a) !== isFolder(b)) {
      return isFolder(a) ? -1 : 1;
    }
    // Puis tri alphabétique
    return a.name.localeCompare(b.name);
  });
  
  // Fonction pour vérifier si un groupe ou ses parents correspondent à la recherche
  const matchesSearch = (group, term) => {
    if (!term) return true;
    
    const termLower = term.toLowerCase();
    
    // Vérifier le nom du groupe
    if (group.name.toLowerCase().includes(termLower)) {
      return true;
    }
    
    // Vérifier les noms des parents
    let current = group;
    while (current.parentId) {
      const parent = state.groups.find(g => g.id === current.parentId);
      if (!parent) break;
      
      if (parent.name.toLowerCase().includes(termLower)) {
        return true;
      }
      
      current = parent;
    }
    
    return false;
  };
  
  // Filtrer les groupes en fonction du terme de recherche
  const filteredGroups = searchTerm 
    ? groupsSorted.filter(group => matchesSearch(group, searchTerm))
    : groupsSorted;
    
  const rootGroups = filteredGroups.filter(g => !g.parentId);
  
  if (filteredGroups.length === 0) {
    elements.groupsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h5l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          </svg>
        </span>
        <p>${searchTerm ? 'Aucun résultat trouvé' : 'Aucun groupe créé'}</p>
      </div>
    `;
    return;
  }

  // Trier les groupes par nom
  const sortedGroups = [...state.groups].sort((a, b) => a.name.localeCompare(b.name));
  
  const html = sortedGroups.map(group => {
    const groupScenarios = state.scenarios
      .filter(s => s.groupId === group.id)
      .sort((a, b) => a.Name.localeCompare(b.Name));
    
    const scenarioCount = groupScenarios.length;
    const isExpanded = state.expandedGroups && state.expandedGroups[group.id];
    
    return `
      <div class="group-card ${isExpanded ? 'expanded' : ''}" data-id="${group.id}">
        <div class="group-card-header">
          <span class="group-name">
            <span class="toggle-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </span>
            <span class="group-name-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7a2 2 0 0 1 2-2h5l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              </svg>
            </span>
            ${escapeHtml(group.name)}
            <span class="group-count">${scenarioCount} scénario(s)</span>
          </span>
          <div class="group-actions">
            <button class="btn btn-xs btn-primary btn-play-group" data-id="${group.id}" ${scenarioCount === 0 ? 'disabled' : ''}>
              <span class="btn-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="6 3 20 12 6 21 6 3"></polygon>
                </svg>
              </span>
              Rejouer
            </button>
            <button class="cmd-icon-btn btn-rename-group" data-id="${group.id}" title="Renommer" aria-label="Renommer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
              </svg>
            </button>
            <button class="cmd-icon-btn btn-delete-group" data-id="${group.id}" title="Supprimer" aria-label="Supprimer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                <path d="M10 11v6"></path>
                <path d="M14 11v6"></path>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
              </svg>
            </button>
          </div>
        </div>
        ${scenarioCount > 0 ? `
          <div class="group-scenarios" style="${isExpanded ? '' : 'display: none;'}">
            ${groupScenarios.map(scenario => `
              <div class="group-scenario-item" data-id="${scenario.id}">
                <span class="group-scenario-name" title="${escapeHtml(scenario.Name)}">
                  ${escapeHtml(scenario.Name)}
                </span>
                <div class="group-scenario-actions">
                  <button class="btn-load-scenario" title="Charger ce scénario" data-id="${scenario.id}">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                  </button>
                  <button class="btn-edit-scenario" title="Éditer ce scénario" data-id="${scenario.id}">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>
                    </svg>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  elements.groupsList.innerHTML = rootGroups.map(group => renderGroupItem(group)).join('');
  
  // Ajouter les écouteurs d'événements
  setupGroupEventListeners();
  
  // Mettre à jour les sélecteurs de groupe
  updateGroupSelects();

  // Gestion du clic sur l'en-tête du groupe pour le plier/déplier
  elements.groupsList.querySelectorAll('.group-card-header').forEach(header => {
    const card = header.closest('.group-card');
    const groupId = card.dataset.id;
    const scenariosContainer = card.querySelector('.group-scenarios');
    
    header.addEventListener('click', (e) => {
      // Ne pas déclencher si le clic est sur un bouton d'action
      if (e.target.closest('button')) return;
      
      const isExpanded = card.classList.toggle('expanded');
      
      // Mettre à jour l'état d'expansion
      state.expandedGroups = state.expandedGroups || {};
      state.expandedGroups[groupId] = isExpanded;
      
      // Animer l'ouverture/fermeture
      if (scenariosContainer) {
        if (isExpanded) {
          scenariosContainer.style.display = 'block';
          scenariosContainer.style.maxHeight = scenariosContainer.scrollHeight + 'px';
        } else {
          scenariosContainer.style.maxHeight = '0';
          setTimeout(() => {
            if (!card.classList.contains('expanded')) {
              scenariosContainer.style.display = 'none';
            }
          }, 300); // Correspond à la durée de la transition
        }
      }
    });
  });

  // Gestion des boutons d'action des scénarios
  elements.groupsList.querySelectorAll('.btn-load-scenario').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      loadScenario(btn.dataset.id);
      // Activer l'onglet d'enregistrement
      document.querySelector('[data-tab="recorder"]').click();
    });
  });

  elements.groupsList.querySelectorAll('.btn-edit-scenario').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditScenarioModal(btn.dataset.id);
    });
  });

  // Gestion des boutons de groupe
  elements.groupsList.querySelectorAll('.btn-play-group').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openGroupPlayModal(btn.dataset.id);
    });
  });

  elements.groupsList.querySelectorAll('.btn-rename-group').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      renameGroup(btn.dataset.id);
    });
  });

  elements.groupsList.querySelectorAll('.btn-delete-group').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteGroup(btn.dataset.id);
    });
  });
}

async function addGroup(name, parentId = null, isFolder = true) {
  const groupName = name.trim();
  if (!groupName) return null;

  const newGroup = {
    id: generateId(),
    name: groupName,
    parentId,
    isFolder,
    createdAt: new Date().toISOString()
  };
  
  state.groups.push(newGroup);
  await saveData();
  refreshGroupsList();
  updateGroupSelects();
  
  // Développer le dossier parent si nécessaire
  if (parentId) {
    state.expandedFolders.add(parentId);
  }
  
  return newGroup;
}

elements.btnAddGroup.addEventListener('click', async () => {
  const name = elements.newGroupName.value.trim();
  if (!name) return;

  // Découper en segments hiérarchiques
  const pathParts = name.split('/').map(part => part.trim()).filter(Boolean);
  let currentParentId = null;

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];

    // Vérifier si un groupe de même nom existe déjà au même niveau
    const existingGroup = state.groups.find(
      g => g.name.toLowerCase() === part.toLowerCase() && 
           g.parentId === currentParentId
    );

    if (existingGroup) {
      // Si le groupe existe, on l'utilise comme parent pour le prochain segment
      currentParentId = existingGroup.id;
    } else {
      // Créer un nouveau dossier (toujours un dossier maintenant)
      const newGroup = await addGroup(part, currentParentId, true);
      if (newGroup) {
        currentParentId = newGroup.id;
      }
    }
  }

  elements.newGroupName.value = '';
  showToast('Groupe créé avec succès', 'success');
});

async function renameGroup(id) {
  const group = state.groups.find(g => g.id === id);
  if (!group) return;

  const newName = prompt('Nouveau nom:', group.name);
  if (!newName || newName === group.name) return;

  group.name = newName;
  await saveData();
  updateGroupSelects();
  refreshGroupsList();
}

async function deleteGroup(id) {
  const scenarioCount = state.scenarios.filter(s => s.groupId === id).length;
  const msg = scenarioCount > 0 
    ? `Ce groupe contient ${scenarioCount} scénario(s). Les scénarios seront conservés sans groupe. Continuer ?`
    : 'Supprimer ce groupe ?';
    
  if (!confirm(msg)) return;

  state.scenarios.forEach(s => {
    if (s.groupId === id) s.groupId = '';
  });
  
  state.groups = state.groups.filter(g => g.id !== id);
  await saveData();
  updateGroupSelects();
  refreshGroupsList();
}

function updateGroupSelects() {
  const options = '<option value="">Sans groupe</option>' + 
    state.groups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
  
  elements.scenarioGroup.innerHTML = options;
  elements.filterGroup.innerHTML = '<option value="">Tous les groupes</option>' + 
    state.groups.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
}

// ==================== GROUP PLAY ====================

function openGroupPlayModal(groupId) {
  state.playingGroupId = groupId;
  
  // Fonction récursive pour collecter tous les scénarios du groupe et de ses sous-groupes
  const collectScenarios = (id) => {
    let scenarios = [];
    
    // Ajouter les scénarios du groupe actuel
    scenarios.push(...state.scenarios.filter(s => s.groupId === id));
    
    // Trouver les sous-groupes
    const childGroups = state.groups.filter(g => g.parentId === id);
    
    // Parcourir récursivement les sous-groupes
    for (const childGroup of childGroups) {
      scenarios.push(...collectScenarios(childGroup.id));
    }
    
    return scenarios;
  };
  
  const groupScenarios = collectScenarios(groupId);
  
  if (groupScenarios.length === 0) {
    showNotification('Aucun scénario trouvé dans ce dossier', 'warning');
    return;
  }

  // Trier les scénarios par nom
  groupScenarios.sort((a, b) => a.Name.localeCompare(b.Name));
  
  elements.groupScenariosList.innerHTML = groupScenarios.map(s => {
    const activeCount = s.Commands ? s.Commands.filter(c => !c.disabled).length : 0;
    const group = state.groups.find(g => g.id === s.groupId);
    const groupName = group ? group.name : 'Sans groupe';
    
    return `
      <div class="scenario-check-item">
        <input type="checkbox" id="check-${s.id}" data-id="${s.id}" checked>
        <label for="check-${s.id}">
          ${escapeHtml(s.Name)} 
          <span class="scenario-meta">
            (${activeCount} actions actives, groupe: ${escapeHtml(groupName)})
          </span>
        </label>
      </div>
    `;
  }).join('');

  elements.groupPlayModal.classList.add('active');
}

elements.groupPlayClose.addEventListener('click', closeGroupPlayModal);
elements.groupPlayCancel.addEventListener('click', closeGroupPlayModal);

function closeGroupPlayModal() {
  elements.groupPlayModal.classList.remove('active');
  state.playingGroupId = null;
}

// ==================== HIGHLIGHT STYLE ====================

// Load highlight style from storage
function loadHighlightStyle() {
  chrome.storage.sync.get(['highlightStyle'], function(result) {
    const style = result.highlightStyle || 'modern';
    // Update active state in UI
    document.querySelectorAll('.highlight-option').forEach(option => {
      option.classList.toggle('active', option.dataset.style === style);
    });
  });
}

// Setup highlight style selector
function setupHighlightStyleSelector() {
  const options = document.querySelectorAll('.highlight-option');
  
  options.forEach(option => {
    option.addEventListener('click', () => {
      const style = option.dataset.style;
      if (!style) return;
      
      // Update active state
      options.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      
      // Save to storage
      chrome.storage.sync.set({ highlightStyle: style }, () => {
        showToast(`Style de surbrillance défini sur: ${style}`, 'success');
      });
    });
  });
}

// ==================== SETTINGS (BACKUP/RESTORE) ====================

if (elements.btnSettings) {
  elements.btnSettings.addEventListener('click', () => openSettingsModal());
}

if (elements.settingsClose) elements.settingsClose.addEventListener('click', closeSettingsModal);
if (elements.settingsCancel) elements.settingsCancel.addEventListener('click', closeSettingsModal);

function openSettingsModal() {
  if (!elements.settingsModal) return;
  elements.settingsModal.classList.add('active');
  setSettingsTab('backup');
}

function closeSettingsModal() {
  if (!elements.settingsModal) return;
  elements.settingsModal.classList.remove('active');
}

if (elements.btnGenerateBackup) {
  elements.btnGenerateBackup.addEventListener('click', async () => {
    try {
      const keys = ['mkpGroups', 'mkpScenarios', 'mkpRecorderState'];
      const data = await chrome.storage.local.get(keys);
      const backup = {
        meta: {
          version: (chrome.runtime.getManifest && chrome.runtime.getManifest().version) ? chrome.runtime.getManifest().version : null,
          exportedAt: new Date().toISOString()
        },
        data: {
          mkpGroups: data.mkpGroups || [],
          mkpScenarios: data.mkpScenarios || [],
          mkpRecorderState: data.mkpRecorderState || null
        }
      };

      const json = JSON.stringify(backup, null, 2);
      if (elements.backupOutput) elements.backupOutput.value = json;
      showToast('Backup généré', 'success');
      logEvent({ level: 'success', category: 'backup', action: 'generate', message: 'Backup généré' });
    } catch (e) {
      showToast(e && e.message ? e.message : 'Erreur backup', 'error');
      logEvent({ level: 'error', category: 'backup', action: 'generate', message: 'Erreur backup', data: { error: e && e.message ? e.message : String(e) } });
    }
  });
}

if (elements.btnCopyBackup) {
  elements.btnCopyBackup.addEventListener('click', async () => {
    const text = elements.backupOutput ? elements.backupOutput.value : '';
    if (!text) {
      showToast('Aucun backup à copier', 'error');
      logEvent({ level: 'warn', category: 'backup', action: 'copy', message: 'Aucun backup à copier' });
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        elements.backupOutput.focus();
        elements.backupOutput.select();
        document.execCommand('copy');
      }
      showToast('Backup copié', 'success');
      logEvent({ level: 'success', category: 'backup', action: 'copy', message: 'Backup copié' });
    } catch (e) {
      showToast('Impossible de copier', 'error');
      logEvent({ level: 'error', category: 'backup', action: 'copy', message: 'Impossible de copier', data: { error: e && e.message ? e.message : String(e) } });
    }
  });
}

if (elements.btnDownloadBackup) {
  elements.btnDownloadBackup.addEventListener('click', () => {
    const text = elements.backupOutput ? elements.backupOutput.value : '';
    if (!text) {
      showToast('Aucun backup à télécharger', 'error');
      logEvent({ level: 'warn', category: 'backup', action: 'download', message: 'Aucun backup à télécharger' });
      return;
    }

    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mkp-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Téléchargement lancé', 'success');
      logEvent({ level: 'success', category: 'backup', action: 'download', message: 'Téléchargement backup lancé' });
    } catch (e) {
      showToast('Impossible de télécharger', 'error');
      logEvent({ level: 'error', category: 'backup', action: 'download', message: 'Impossible de télécharger', data: { error: e && e.message ? e.message : String(e) } });
    }
  });
}

if (elements.btnLoadBackupFile && elements.backupFileInput) {
  elements.btnLoadBackupFile.addEventListener('click', () => elements.backupFileInput.click());
  elements.backupFileInput.addEventListener('change', async () => {
    const file = elements.backupFileInput.files && elements.backupFileInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (elements.backupInput) elements.backupInput.value = text;
      showToast('Fichier chargé', 'success');
      logEvent({ level: 'success', category: 'backup', action: 'load_file', message: 'Fichier backup chargé' });
    } catch (e) {
      showToast('Impossible de lire le fichier', 'error');
      logEvent({ level: 'error', category: 'backup', action: 'load_file', message: 'Impossible de lire le fichier', data: { error: e && e.message ? e.message : String(e) } });
    } finally {
      elements.backupFileInput.value = '';
    }
  });
}

if (elements.btnRestoreBackup) {
  elements.btnRestoreBackup.addEventListener('click', async () => {
    const text = elements.backupInput ? elements.backupInput.value : '';
    if (!text) {
      showToast('Collez un JSON de backup', 'error');
      logEvent({ level: 'warn', category: 'backup', action: 'restore', message: 'Backup vide' });
      return;
    }

    if (!confirm('Restaurer ce backup va écraser les données actuelles. Continuer ?')) return;

    try {
      const parsed = JSON.parse(text);
      const data = parsed && parsed.data ? parsed.data : parsed;

      const mkpGroups = Array.isArray(data.mkpGroups) ? data.mkpGroups : [];
      const mkpScenarios = Array.isArray(data.mkpScenarios) ? data.mkpScenarios : [];
      const mkpRecorderState = (data.mkpRecorderState && typeof data.mkpRecorderState === 'object') ? data.mkpRecorderState : null;

      await chrome.storage.local.set({
        mkpGroups,
        mkpScenarios,
        mkpRecorderState
      });

      await loadData();
      await loadRecordingState();
      refreshScenariosList();
      refreshGroupsList();
      updateUIState();
      
      // Afficher la version du plugin
      displayVersion();

      try {
        await chrome.runtime.sendMessage({ type: 'RELOAD_STATE' });
      } catch (e) {}

      showToast('Restore terminé', 'success');
      logEvent({ level: 'success', category: 'backup', action: 'restore', message: 'Restore terminé' });
    } catch (e) {
      showToast(e && e.message ? e.message : 'JSON invalide', 'error');
      logEvent({ level: 'error', category: 'backup', action: 'restore', message: 'Erreur restore', data: { error: e && e.message ? e.message : String(e) } });
    }
  });
}

if (elements.btnRefreshLogs) elements.btnRefreshLogs.addEventListener('click', refreshLogs);
if (elements.btnExportLogs) elements.btnExportLogs.addEventListener('click', exportLogs);
if (elements.btnClearLogs) elements.btnClearLogs.addEventListener('click', clearLogs);
if (elements.logLevelFilter) elements.logLevelFilter.addEventListener('change', renderLogs);
if (elements.logSearch) elements.logSearch.addEventListener('input', renderLogs);

elements.groupPlayStart.addEventListener('click', async () => {
  const checkedIds = Array.from(elements.groupScenariosList.querySelectorAll('input:checked'))
    .map(cb => cb.dataset.id);
  
  if (checkedIds.length === 0) {
    alert('Sélectionnez au moins un scénario');
    return;
  }

  const useRealTiming = elements.useRealTiming.checked;
  closeGroupPlayModal();

  // Get scenarios and filter disabled commands
  const scenariosToPlay = checkedIds.map(id => {
    const s = state.scenarios.find(sc => sc.id === id);
    if (!s) return null;
    return {
      ...s,
      Commands: s.Commands.filter(c => !c.disabled)
    };
  }).filter(Boolean);
  
  // Store the ordered list of scenario IDs for live UI highlighting
  state.groupPlaybackOrderIds = scenariosToPlay.map(s => s.id);
  state.currentPlayingScenarioId = null;
  // If Groups tab is visible, ensure initial render has no leftover highlight
  if (document.querySelector('#tab-groups.tab-pane.active')) {
    refreshGroupsList();
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    showStatus('error', 'Impossible de lancer');
    return;
  }

  showStatus('playing', `Lecture groupe: 0/${scenariosToPlay.length}`);
  
  await chrome.runtime.sendMessage({
    type: 'PLAY_GROUP',
    scenarios: scenariosToPlay,
    tabId: tab.id,
    useRealTiming: useRealTiming
  });

  pollGroupPlayback(scenariosToPlay.length);
});

function setPlayingScenarioHighlight(scenarioId) {
  try {
    // Remove previous
    if (state.currentPlayingScenarioId) {
      const prevEl = document.querySelector(`#tab-groups .scenario-item[data-id="${state.currentPlayingScenarioId}"]`);
      if (prevEl) prevEl.classList.remove('playing');
    }
    state.currentPlayingScenarioId = scenarioId || null;
    if (scenarioId) {
      const el = document.querySelector(`#tab-groups .scenario-item[data-id="${scenarioId}"]`);
      if (el) {
        el.classList.add('playing');
        // Ensure visible
        const container = document.querySelector('#tab-groups .groups-list, #tab-groups');
        // Only scroll if not already sufficiently visible
        if (el.scrollIntoView && container) {
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    }
  } catch (e) {
    // ignore
  }
}

function clearPlayingScenarioHighlight() {
  setPlayingScenarioHighlight(null);
  // Also re-render the list to remove any residual state-based class
  if (document.querySelector('#tab-groups.tab-pane.active')) {
    refreshGroupsList();
  }
}

function pollGroupPlayback(total) {
  const interval = setInterval(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'GET_PLAYBACK_STATE' });
    const st = response.state;

    if (st.status === 'playing') {
      const scenarioNum = (st.scenarioIndex || 0) + 1;
      // Determine current scenario id using background-provided id or our stored order
      const currentScenarioId = st.scenarioId || state.groupPlaybackOrderIds[st.scenarioIndex] || null;
      if (currentScenarioId && currentScenarioId !== state.currentPlayingScenarioId) {
        setPlayingScenarioHighlight(currentScenarioId);
      }
      showStatus('playing', `Scénario ${scenarioNum}/${total} - Action ${st.currentIndex + 1}/${st.total}`);
    } else if (st.status === 'completed') {
      clearInterval(interval);
      showStatus('success', 'Lecture groupe terminé');
      showToast('Lecture du groupe terminée sans erreur', 'success');
      clearPlayingScenarioHighlight();
      state.groupPlaybackOrderIds = [];
    } else if (st.status === 'error' || st.status === 'stopped') {
      clearInterval(interval);
      showStatus('error', st.error || 'Arrêté');
      clearPlayingScenarioHighlight();
      state.groupPlaybackOrderIds = [];
    }
  }, 200);
}

// ==================== UI HELPERS ====================

function updateUIState() {
  if (state.isRecording) {
    elements.btnStart.disabled = true;
    elements.btnStop.disabled = false;
    elements.btnPlay.disabled = true;
    if (elements.btnPlayAll) elements.btnPlayAll.disabled = true;
    showStatus('recording', 'Enregistrement en cours...');
  } else {
    elements.btnStart.disabled = false;
    elements.btnStop.disabled = true;
    elements.btnPlay.disabled = state.currentScenario.Commands.length === 0;
    if (elements.btnPlayAll) elements.btnPlayAll.disabled = state.currentScenario.Commands.length === 0;
  }
}

function showStatus(type, text) {
  elements.statusBar.className = 'status-bar ' + type;
  elements.statusBar.querySelector('.status-text').textContent = text;
}

function showToast(message, type = 'success') {
  if (!message) return;

  const existing = document.getElementById('mkp-toast-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'mkp-toast-overlay';

  const statusText = type === 'error' ? 'Erreur' : 'Succès';

  overlay.innerHTML = `
    <div class="mkp-playback-inner mkp-toast-inner">
      <div class="mkp-playback-header">
        <div class="mkp-playback-status">
          <div class="mkp-play-pulse mkp-toast-pulse ${type}"></div>
          <span>${statusText}</span>
        </div>
        <button class="mkp-btn mkp-btn-retry" id="mkp-toast-close">OK</button>
      </div>
      <div class="mkp-playback-info">
        <div class="mkp-step-label">Message</div>
        <div class="mkp-step-target" id="mkp-toast-message"></div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const msgEl = document.getElementById('mkp-toast-message');
  if (msgEl) msgEl.textContent = message;

  const btn = document.getElementById('mkp-toast-close');
  if (btn) {
    btn.addEventListener('click', () => {
      const el = document.getElementById('mkp-toast-overlay');
      if (el) el.remove();
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==================== BACKGROUND SYNC ====================

async function loadCurrentScenario() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SCENARIO' });
  if (response && response.scenario) {
    state.currentScenario.Commands = response.scenario.Commands;
    renderCommands();
  }
}

async function syncToBackground() {
  await chrome.runtime.sendMessage({
    type: 'SET_SCENARIO',
    scenario: state.currentScenario
  });
}

async function loadRecordingState() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' });
  if (response) {
    state.isRecording = response.isRecording;
    updateUIState();
    if (state.isRecording) startPolling();
  }
}

// ==================== POLLING ====================

let pollInterval = null;

function startPolling() {
  stopPolling();
  pollInterval = setInterval(loadCurrentScenario, 500);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// ==================== HIERARCHY HELPERS ====================

function getGroupPath(group) {
  if (!group) return [];
  if (!group.parentId) return [group.id];
  const parent = state.groups.find(g => g.id === group.parentId);
  return [...getGroupPath(parent), group.id];
}

function getGroupBreadcrumb(group) {
  if (!group) return [];
  if (!group.parentId) return [group];
  const parent = state.groups.find(g => g.id === group.parentId);
  return [...getGroupBreadcrumb(parent), group];
}

function getChildGroups(groupId) {
  return state.groups.filter(g => g.parentId === groupId);
}

function isFolder(group) {
  return group.isFolder || false;
}

function toggleFolder(folderId) {
  if (state.expandedFolders.has(folderId)) {
    state.expandedFolders.delete(folderId);
  } else {
    state.expandedFolders.add(folderId);
  }
  refreshGroupsList();
}

async function createGroup(name, parentId = null, isFolder = false) {
  const newGroup = {
    id: generateId(),
    name: name.trim(),
    parentId,
    isFolder,
    createdAt: new Date().toISOString()
  };
  
  state.groups.push(newGroup);
  await saveData();
  refreshGroupsList();
  return newGroup;
}

// ==================== VERSION ====================

// Afficher la version du plugin
function displayVersion() {
  try {
    console.log('Affichage de la version...');
    const manifest = chrome.runtime.getManifest();
    console.log('Manifest:', manifest);
    const version = manifest.version;
    const versionBadge = document.getElementById('version-badge');
    console.log('Version badge element:', versionBadge);
    if (versionBadge) {
      versionBadge.textContent = `v${version}`;
      console.log('Version affichée avec succès');
    } else {
      console.error('Élément version-badge introuvable');
    }
  } catch (error) {
    console.error('Erreur lors de l\'affichage de la version:', error);
  }
}

// ==================== PASTE SCENARIO ====================

// Fonction pour mettre à jour la liste déroulante des groupes
async function updateGroupSelect(selectElement) {
  if (!selectElement) return;
  
  const currentValue = selectElement.value;
  selectElement.innerHTML = '<option value="">Sans groupe</option>';
  
  state.groups
    .filter(group => !group.isFolder)
    .forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name;
      selectElement.appendChild(option);
    });
  
  if (currentValue && Array.from(selectElement.options).some(opt => opt.value === currentValue)) {
    selectElement.value = currentValue;
  }
}

// Fonction pour afficher une erreur
function showError(message) {
  if (!elements.pasteError) return;
  
  elements.pasteError.textContent = message;
  elements.pasteError.style.display = 'block';
  setTimeout(() => {
    if (elements.pasteError) {
      elements.pasteError.style.display = 'none';
    }
  }, 5000);
}

// Gestionnaire d'événements pour le bouton "Coller un scénario"
if (elements.btnPasteScenario) {
  elements.btnPasteScenario.addEventListener('click', () => {
    updateGroupSelect(elements.pasteGroup);
    elements.pasteModal.style.display = 'flex';
    elements.scenarioJson.focus();
  });
}

// Gestionnaire d'événements pour fermer la modale
if (elements.closePasteModal) {
  elements.closePasteModal.addEventListener('click', () => {
    elements.pasteModal.style.display = 'none';
  });
}

if (elements.cancelPaste) {
  elements.cancelPaste.addEventListener('click', () => {
    elements.pasteModal.style.display = 'none';
  });
}

// Gestionnaire d'événements pour confirmer l'import
if (elements.confirmPaste) {
  elements.confirmPaste.addEventListener('click', async () => {
    try {
      const jsonText = elements.scenarioJson.value.trim();
      if (!jsonText) {
        showError('Veuillez coller un scénario au format JSON');
        return;
      }

      const scenario = JSON.parse(jsonText);
      
      if (!scenario.Name || !Array.isArray(scenario.Commands)) {
        throw new Error('Format de scénario invalide');
      }

      // Créer un nouveau scénario avec un nouvel ID
      const newScenario = {
        ...scenario,
        id: generateId(),
        CreationDate: new Date().toISOString(),
        groupId: elements.pasteGroup.value || null
      };

      // Ajouter le scénario à la liste
      state.scenarios.push(newScenario);
      await saveData();
      
      // Mettre à jour l'interface
      await refreshScenariosList();
      showToast('Scénario importé avec succès');
      
      // Fermer la modale et réinitialiser le formulaire
      elements.pasteModal.style.display = 'none';
      elements.scenarioJson.value = '';
      
    } catch (error) {
      console.error('Erreur lors de l\'import du scénario:', error);
      showError(error.message || 'Erreur lors de l\'analyse du JSON');
    }
  });
}

// ==================== INIT ====================

async function init() {
  // Afficher la version du plugin
  console.log('Initialisation de la popup...');
  displayVersion();

  // Initialize search functionality
  const commandSearch = document.getElementById('commandSearch');
  if (commandSearch) {
    commandSearch.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const commandItems = document.querySelectorAll('.command-item:not(.empty-state)');
      let visibleCount = 0;
      
      commandItems.forEach(item => {
        const commandText = item.textContent.toLowerCase();
        const isVisible = commandText.includes(searchTerm);
        item.style.display = isVisible ? 'flex' : 'none';
        if (isVisible) visibleCount++;
      });
      
      // Update command count
      const commandCount = document.getElementById('commandCount');
      if (commandCount) {
        commandCount.textContent = visibleCount;
      }
      
      // Show/hide empty state
      const emptyState = document.querySelector('.commands-list .empty-state');
      if (emptyState) {
        emptyState.style.display = visibleCount === 0 && searchTerm === '' ? 'none' : 
                                 (visibleCount === 0 ? 'flex' : 'none');
      }
    });
  }
  
  // Initialize settings tabs
  initSettingsTabs();
  if (elements.themeSelect) {
    elements.themeSelect.addEventListener('change', async () => {
      await saveTheme(elements.themeSelect.value);
    });
  }
  if (elements.playbackModeSelect) {
    elements.playbackModeSelect.addEventListener('change', async () => {
      await savePlaybackMode(elements.playbackModeSelect.value);
    });
  }
  // Theme management
  loadTheme();
  // Playback mode management
  await loadPlaybackMode();
  
  // Load highlight style
  loadHighlightStyle();
  
  // Setup highlight style selector
  setupHighlightStyleSelector();
  
  // Initialize expanded groups
  state.expandedGroups = state.expandedGroups || {};
  
  await loadData();
  await loadCurrentScenario();
  await loadRecordingState();
  await refreshLogs();
  
  // Initialiser la recherche de groupes
  document.getElementById('searchGroups')?.addEventListener('input', (e) => {
    refreshGroupsList(e.target.value);
  });

  elements.btnHelp?.addEventListener('click', () => {
    if (elements.helpModal) elements.helpModal.classList.add('active');
  });

  elements.helpClose?.addEventListener('click', () => {
    if (elements.helpModal) elements.helpModal.classList.remove('active');
  });

  elements.helpCloseBtn?.addEventListener('click', () => {
    if (elements.helpModal) elements.helpModal.classList.remove('active');
  });

  window.addEventListener('click', (e) => {
    if (elements.helpModal && e.target === elements.helpModal) {
      elements.helpModal.classList.remove('active');
    }
    if (elements.sourceModal && e.target === elements.sourceModal) {
      elements.sourceModal.classList.remove('active');
    }
  });

  // Source code modal handlers
  if (elements.btnShowSource) {
    elements.btnShowSource.addEventListener('click', () => {
      try {
        const data = buildCurrentScenarioJson();
        const json = JSON.stringify(data, null, 2);
        if (elements.sourceJsonEditor) elements.sourceJsonEditor.value = json;
        if (elements.sourceError) { elements.sourceError.style.display = 'none'; elements.sourceError.textContent = ''; }
        if (elements.sourceModal) elements.sourceModal.classList.add('active');
      } catch (e) {
        console.error('Erreur génération code source:', e);
        showToast('Impossible d\'afficher le code source', 'error');
      }
    });
  }
  if (elements.sourceClose) {
    elements.sourceClose.addEventListener('click', () => elements.sourceModal?.classList.remove('active'));
  }
  if (elements.sourceCloseBtn) {
    elements.sourceCloseBtn.addEventListener('click', () => elements.sourceModal?.classList.remove('active'));
  }
  if (elements.sourceCopy) {
    elements.sourceCopy.addEventListener('click', async () => {
      try {
        const text = elements.sourceJsonEditor ? elements.sourceJsonEditor.value : '';
        if (!text) {
          showToast('Rien à copier', 'error');
          return;
        }
        await navigator.clipboard.writeText(text);
        showToast('Code source copié', 'success');
      } catch (e) {
        console.error('Copy failed', e);
        showToast('Impossible de copier', 'error');
      }
    });
  }
  if (elements.sourceSave) {
    elements.sourceSave.addEventListener('click', () => {
      const showInlineError = (msg) => {
        if (elements.sourceError) {
          elements.sourceError.textContent = msg || 'Erreur inconnue';
          elements.sourceError.style.display = 'block';
        }
      };
      try {
        const raw = elements.sourceJsonEditor ? elements.sourceJsonEditor.value.trim() : '';
        if (!raw) {
          showInlineError('Veuillez saisir du JSON valide');
          showToast('JSON vide', 'error');
          return;
        }
        let data;
        try {
          data = JSON.parse(raw);
        } catch (e) {
          showInlineError('JSON invalide');
          showToast('JSON invalide', 'error');
          return;
        }
        // Validation de base
        if (!data || typeof data !== 'object') {
          showInlineError('Format non reconnu');
          showToast('Format non reconnu', 'error');
          return;
        }
        const name = typeof data.Name === 'string' && data.Name.trim() ? data.Name.trim() : null;
        const commandsIn = Array.isArray(data.Commands) ? data.Commands : null;
        if (!name) {
          showInlineError('Champ "Name" requis');
          showToast('Champ Name requis', 'error');
          return;
        }
        if (!commandsIn) {
          showInlineError('Champ "Commands" doit être un tableau');
          showToast('Commands doit être un tableau', 'error');
          return;
        }
        // Normalisation des commandes
        const commands = commandsIn.map((c, idx) => {
          const cmd = c || {};
          const Command = (cmd.Command ?? '').toString().trim();
          const Target = (cmd.Target ?? '').toString().trim();
          const ValueRaw = cmd.Value;
          const timingRaw = cmd.timing;
          const out = { Command, Target };
          if (ValueRaw !== undefined && ValueRaw !== null && String(ValueRaw).trim() !== '') {
            out.Value = String(ValueRaw);
          }
          const timingNum = typeof timingRaw === 'number' ? timingRaw : Number.isFinite(Number(timingRaw)) ? Number(timingRaw) : undefined;
          if (typeof timingNum === 'number' && Number.isFinite(timingNum)) {
            out.timing = timingNum;
          }
          return out;
        }).filter(c => c.Command || c.Target);
        // Confirmation si vide
        if (commands.length === 0) {
          const ok = confirm('Le tableau Commands est vide. Remplacer le scénario actuel par un scénario vide ?');
          if (!ok) return;
        }
        // Mettre à jour l'état courant (mémoire uniquement)
        const current = state.currentScenario || createEmptyScenario();
        state.currentScenario = {
          ...current,
          Name: name,
          CreationDate: (typeof data.CreationDate === 'string' && data.CreationDate.trim()) ? data.CreationDate : (current.CreationDate || new Date().toISOString().split('T')[0]),
          Commands: commands
        };
        // Mettre à jour l'UI
        if (elements.scenarioName) elements.scenarioName.value = state.currentScenario.Name;
        renderCommands();
        syncToBackground?.();
        // Fermer et notifier
        if (elements.sourceModal) elements.sourceModal.classList.remove('active');
        showToast('Scénario mis à jour (mémoire)', 'success');
      } catch (err) {
        console.error('Erreur lors de l\'enregistrement du JSON source', err);
        showInlineError('Erreur inattendue');
        showToast('Erreur lors de l\'enregistrement', 'error');
      }
    });
  }
  
  if (state.currentScenario.Name) {
    elements.scenarioName.value = state.currentScenario.Name;
  }
  if (state.currentScenario.groupId) {
    elements.scenarioGroup.value = state.currentScenario.groupId;
  }
  
  renderCommands();
}

// Fonction pour exécuter une seule commande
async function executeSingleCommand(index, options = {}) {
  if (state.isPlaying && !options?.bypassPlayingGuard) return;
  
  const commands = state.currentScenario.Commands;
  if (index < 0 || index >= commands.length) return;
  
  // Mettre en surbrillance la commande en cours d'exécution
  const commandItems = elements.commandsList.querySelectorAll('.command-item');
  commandItems.forEach((item, i) => {
    item.classList.toggle('executing', i === index);
  });
  
  try {
    // Envoyer la commande au script de contenu pour exécution
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Vérifier si le script de contenu est injecté
    try {
      // Essayer d'abord d'injecter le script s'il n'est pas déjà chargé
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content_script.js']
      });
    } catch (injectError) {
      console.log('Le script de contenu est déjà injecté ou une erreur est survenue:', injectError);
    }
    
    // Utiliser un délai pour s'assurer que le script est prêt
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Envoyer le message avec un timeout
    const response = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout: La commande a pris trop de temps pour s\'exécuter'));
      }, 10000); // 10 secondes de timeout
      
      chrome.tabs.sendMessage(tab.id, { 
        action: 'executeCommand', 
        command: commands[index],
        index: index
      }, (response) => {
        clearTimeout(timeoutId);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Erreur inconnue'));
        } else {
          resolve(response);
        }
      });
    });
    
    if (response && response.success) {
      showToast('Commande exécutée avec succès', 'success');
    } else {
      throw new Error(response?.error || 'Échec de l\'exécution de la commande');
    }
    
  } catch (error) {
    console.error('Erreur lors de l\'exécution de la commande:', error);
    showToast(`Erreur: ${error.message}`, 'error');
  } finally {
    // Retirer la mise en surbrillance après un court délai pour permettre l'animation
    setTimeout(() => {
      commandItems.forEach(item => item.classList.remove('executing'));
    }, 500);
  }
}

// Gestionnaire pour le bouton de lecture d'une commande
document.addEventListener('click', (e) => {
  if (e.target.closest('.btn-play')) {
    const button = e.target.closest('.btn-play');
    const index = parseInt(button.dataset.index);
    executeSingleCommand(index);
    return;
  }
});

init();
