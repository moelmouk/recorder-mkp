/**
 * MKP Auto Recorder - Popup Script v2.1
 * With scenario/group reassignment, playback overlay, and command disable
 */

// ==================== DOM ELEMENTS ====================

const elements = {
  // Tabs
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  btnSidePanel: document.getElementById('btnSidePanel'),
  btnSettings: document.getElementById('btnSettings'),
  
  // Recorder Tab
  statusBar: document.getElementById('statusBar'),
  scenarioName: document.getElementById('scenarioName'),
  scenarioGroup: document.getElementById('scenarioGroup'),
  btnStart: document.getElementById('btnStart'),
  btnStop: document.getElementById('btnStop'),
  btnPlay: document.getElementById('btnPlay'),
  btnSave: document.getElementById('btnSave'),
  btnClear: document.getElementById('btnClear'),
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
  backupFileInput: document.getElementById('backupFileInput')
};

// ==================== STATE ====================

let state = {
  isRecording: false,
  currentScenario: createEmptyScenario(),
  scenarios: [],
  groups: [],
  editingCommandIndex: -1,
  editingScenarioId: null,
  playingGroupId: null
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
  });
});

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

  state.currentScenario = createEmptyScenario();
  state.currentScenario.Name = elements.scenarioName.value || 'Nouveau scénario';
  state.currentScenario.groupId = elements.scenarioGroup.value;
  
  await chrome.runtime.sendMessage({ type: 'CLEAR_SCENARIO' });
  await chrome.runtime.sendMessage({ type: 'START_RECORDING', tabId: tab.id });
  
  state.isRecording = true;
  updateUIState();
  startPolling();
});

elements.btnStop.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.runtime.sendMessage({ type: 'STOP_RECORDING', tabId: tab ? tab.id : null });
  
  state.isRecording = false;
  updateUIState();
  stopPolling();
  await loadCurrentScenario();
});

// ==================== PLAYBACK ====================

elements.btnPlay.addEventListener('click', async () => {
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

  pollPlaybackState();
});

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
      
    } else if (st.status === 'completed') {
      clearInterval(interval);
      // Mettre la barre à 100% à la fin
      updateGlobalProgress(st.total, st.total);
      showStatus('success', 'Lecture terminée');
      showToast(`Scénario "${(elements.scenarioName && elements.scenarioName.value) ? elements.scenarioName.value : 'Nouveau scénario'}" terminé sans erreur`, 'success');
      elements.btnPlay.disabled = false;
      elements.btnStart.disabled = false;
      clearCommandHighlight();
      
    } else if (st.status === 'error' || st.status === 'stopped') {
      clearInterval(interval);
      showStatus('error', st.error || 'Arrêté');
      elements.btnPlay.disabled = false;
      elements.btnStart.disabled = false;
      clearCommandHighlight();
      
    } else if (st.status === 'skipped') {
      // Mettre à jour la progression même pour les commandes ignorées
      updateGlobalProgress(st.currentIndex + 1, st.total);
      showStatus('playing', `Étape ignorée, continuation...`);
    }
  }, 200);
}

// ==================== SAVE/CLEAR ====================

elements.btnSave.addEventListener('click', async () => {
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
  elements.commandCount.textContent = commands.length;

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
    return;
  }

  elements.btnPlay.disabled = false;

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
  elements.commandsList.querySelectorAll('.command-item').forEach((item, i) => {
    item.classList.toggle('active', i === index);
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

  elements.scenariosList.querySelectorAll('.btn-delete-scenario').forEach(btn => {
    btn.addEventListener('click', () => deleteScenario(btn.dataset.id));
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
  } catch (error) {
    showStatus('error', 'Erreur import: ' + error.message);
  }

  elements.fileImport.value = '';
});

elements.btnExportAll.addEventListener('click', () => {
  if (state.scenarios.length === 0) {
    showStatus('error', 'Aucun scénario à exporter');
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
});

// ==================== GROUPS ====================

function refreshGroupsList() {
  if (state.groups.length === 0) {
    elements.groupsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          </svg>
        </span>
        <p>Aucun groupe créé</p>
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

  elements.groupsList.innerHTML = html;

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

elements.btnAddGroup.addEventListener('click', async () => {
  const name = elements.newGroupName.value.trim();
  if (!name) return;

  state.groups.push({
    id: generateId(),
    name: name
  });

  await saveData();
  elements.newGroupName.value = '';
  updateGroupSelects();
  refreshGroupsList();
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
  const groupScenarios = state.scenarios.filter(s => s.groupId === groupId);
  
  if (groupScenarios.length === 0) return;

  elements.groupScenariosList.innerHTML = groupScenarios.map(s => {
    const activeCount = s.Commands.filter(c => !c.disabled).length;
    return `
      <div class="scenario-check-item">
        <input type="checkbox" id="check-${s.id}" data-id="${s.id}" checked>
        <label for="check-${s.id}">${escapeHtml(s.Name)} (${activeCount} actions actives)</label>
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

// ==================== SETTINGS (BACKUP/RESTORE) ====================

if (elements.btnSettings) {
  elements.btnSettings.addEventListener('click', () => openSettingsModal());
}

if (elements.settingsClose) elements.settingsClose.addEventListener('click', closeSettingsModal);
if (elements.settingsCancel) elements.settingsCancel.addEventListener('click', closeSettingsModal);

function openSettingsModal() {
  if (!elements.settingsModal) return;
  elements.settingsModal.classList.add('active');
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
    } catch (e) {
      showToast(e && e.message ? e.message : 'Erreur backup', 'error');
    }
  });
}

if (elements.btnCopyBackup) {
  elements.btnCopyBackup.addEventListener('click', async () => {
    const text = elements.backupOutput ? elements.backupOutput.value : '';
    if (!text) {
      showToast('Aucun backup à copier', 'error');
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
    } catch (e) {
      showToast('Impossible de copier', 'error');
    }
  });
}

if (elements.btnDownloadBackup) {
  elements.btnDownloadBackup.addEventListener('click', () => {
    const text = elements.backupOutput ? elements.backupOutput.value : '';
    if (!text) {
      showToast('Aucun backup à télécharger', 'error');
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
    } catch (e) {
      showToast('Impossible de télécharger', 'error');
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
    } catch (e) {
      showToast('Impossible de lire le fichier', 'error');
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
      refreshScenariosList();
      refreshGroupsList();

      try {
        await chrome.runtime.sendMessage({ type: 'RELOAD_STATE' });
      } catch (e) {}

      showToast('Restore terminé', 'success');
    } catch (e) {
      showToast(e && e.message ? e.message : 'JSON invalide', 'error');
    }
  });
}

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

function pollGroupPlayback(total) {
  const interval = setInterval(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'GET_PLAYBACK_STATE' });
    const st = response.state;

    if (st.status === 'playing') {
      const scenarioNum = (st.scenarioIndex || 0) + 1;
      showStatus('playing', `Scénario ${scenarioNum}/${total} - Action ${st.currentIndex + 1}/${st.total}`);
    } else if (st.status === 'completed') {
      clearInterval(interval);
      showStatus('success', 'Groupe terminé');
      showToast('Lecture du groupe terminée sans erreur', 'success');
    } else if (st.status === 'error' || st.status === 'stopped') {
      clearInterval(interval);
      showStatus('error', st.error || 'Arrêté');
    }
  }, 200);
}

// ==================== UI HELPERS ====================

function updateUIState() {
  if (state.isRecording) {
    elements.btnStart.disabled = true;
    elements.btnStop.disabled = false;
    elements.btnPlay.disabled = true;
    showStatus('recording', 'Enregistrement en cours...');
  } else {
    elements.btnStart.disabled = false;
    elements.btnStop.disabled = true;
    elements.btnPlay.disabled = state.currentScenario.Commands.length === 0;
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

// ==================== INIT ====================

async function init() {
  // Initialiser l'état des groupes dépliés
  state.expandedGroups = state.expandedGroups || {};
  
  await loadData();
  await loadCurrentScenario();
  await loadRecordingState();
  
  if (state.currentScenario.Name) {
    elements.scenarioName.value = state.currentScenario.Name;
  }
  if (state.currentScenario.groupId) {
    elements.scenarioGroup.value = state.currentScenario.groupId;
  }
  
  renderCommands();
}

init();
