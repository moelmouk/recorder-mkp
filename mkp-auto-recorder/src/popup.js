/**
 * MKP Auto Recorder - Popup Script v2.0
 * With scenarios management, groups, and real timing
 */

// ==================== DOM ELEMENTS ====================

const elements = {
  // Tabs
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabPanes: document.querySelectorAll('.tab-pane'),
  
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
  
  // Modals
  editModal: document.getElementById('editModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  modalClose: document.getElementById('modalClose'),
  modalCancel: document.getElementById('modalCancel'),
  modalSave: document.getElementById('modalSave'),
  
  groupPlayModal: document.getElementById('groupPlayModal'),
  groupScenariosList: document.getElementById('groupScenariosList'),
  useRealTiming: document.getElementById('useRealTiming'),
  groupPlayClose: document.getElementById('groupPlayClose'),
  groupPlayCancel: document.getElementById('groupPlayCancel'),
  groupPlayStart: document.getElementById('groupPlayStart')
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
    
    // Refresh content
    if (tabId === 'scenarios') refreshScenariosList();
    if (tabId === 'groups') refreshGroupsList();
  });
});

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

  // Clear and setup new scenario
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

  await chrome.runtime.sendMessage({
    type: 'SET_SCENARIO',
    scenario: state.currentScenario
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

function pollPlaybackState() {
  const interval = setInterval(async () => {
    const response = await chrome.runtime.sendMessage({ type: 'GET_PLAYBACK_STATE' });
    const st = response.state;

    if (st.status === 'playing') {
      showStatus('playing', `Lecture ${st.currentIndex + 1}/${st.total}...`);
      highlightCommand(st.currentIndex);
    } else if (st.status === 'completed') {
      clearInterval(interval);
      showStatus('success', 'Lecture terminée');
      elements.btnPlay.disabled = false;
      elements.btnStart.disabled = false;
      clearCommandHighlight();
    } else if (st.status === 'error' || st.status === 'stopped') {
      clearInterval(interval);
      showStatus('error', st.error || 'Arrêté');
      elements.btnPlay.disabled = false;
      elements.btnStart.disabled = false;
      clearCommandHighlight();
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

  // Check if updating existing
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
        <span class="empty-icon">📝</span>
        <p>Aucune action enregistrée</p>
      </div>
    `;
    elements.btnPlay.disabled = true;
    return;
  }

  elements.btnPlay.disabled = false;

  const html = commands.map((cmd, index) => {
    const timing = cmd.timing ? `${(cmd.timing / 1000).toFixed(1)}s` : '';
    const targetShort = (cmd.Target || '').substring(0, 50);
    
    return `
      <div class="command-item" data-index="${index}">
        <span class="command-number">${index + 1}</span>
        <div class="command-info">
          <span class="command-type">${escapeHtml(cmd.Command)}</span>
          <div class="command-target" title="${escapeHtml(cmd.Target)}">${escapeHtml(targetShort)}</div>
          ${timing ? `<div class="command-timing">⏱ ${timing}</div>` : ''}
          ${cmd.Value ? `<div class="command-timing">📝 ${escapeHtml(cmd.Value.substring(0, 30))}</div>` : ''}
        </div>
        <div class="command-actions">
          <button class="btn btn-xs btn-secondary btn-edit" data-index="${index}" title="Modifier">✏️</button>
          <button class="btn btn-xs btn-secondary btn-delete" data-index="${index}" title="Supprimer">🗑</button>
        </div>
      </div>
    `;
  }).join('');

  elements.commandsList.innerHTML = html;

  // Add event listeners
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

  // Scroll to bottom
  elements.commandsList.scrollTop = elements.commandsList.scrollHeight;
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
        <span class="empty-icon">📁</span>
        <p>Aucun scénario trouvé</p>
      </div>
    `;
    return;
  }

  const html = filtered.map(scenario => {
    const group = state.groups.find(g => g.id === scenario.groupId);
    const groupName = group ? group.name : 'Sans groupe';
    
    return `
      <div class="scenario-card" data-id="${scenario.id}">
        <div class="scenario-card-header">
          <span class="scenario-name">${escapeHtml(scenario.Name)}</span>
          <span class="scenario-badge">${escapeHtml(groupName)}</span>
        </div>
        <div class="scenario-meta">
          <span>📅 ${scenario.CreationDate}</span>
          <span>📝 ${scenario.Commands.length} actions</span>
        </div>
        <div class="scenario-actions">
          <button class="btn btn-xs btn-primary btn-load" data-id="${scenario.id}">Charger</button>
          <button class="btn btn-xs btn-secondary btn-export" data-id="${scenario.id}">Exporter</button>
          <button class="btn btn-xs btn-secondary btn-delete-scenario" data-id="${scenario.id}">🗑</button>
        </div>
      </div>
    `;
  }).join('');

  elements.scenariosList.innerHTML = html;

  // Event listeners
  elements.scenariosList.querySelectorAll('.btn-load').forEach(btn => {
    btn.addEventListener('click', () => loadScenario(btn.dataset.id));
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
  
  // Switch to recorder tab
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

    // Handle single scenario or array
    const scenarios = Array.isArray(imported) ? imported : [imported];
    
    for (const scenario of scenarios) {
      if (!scenario.Commands || !Array.isArray(scenario.Commands)) continue;
      
      // Assign new ID
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
        <span class="empty-icon">📂</span>
        <p>Aucun groupe créé</p>
      </div>
    `;
    return;
  }

  const html = state.groups.map(group => {
    const scenarioCount = state.scenarios.filter(s => s.groupId === group.id).length;
    
    return `
      <div class="group-card" data-id="${group.id}">
        <div class="group-card-header">
          <span class="group-name">
            <span class="group-name-icon">📁</span>
            ${escapeHtml(group.name)}
          </span>
          <span class="group-count">${scenarioCount} scénario(s)</span>
        </div>
        <div class="group-actions">
          <button class="btn btn-xs btn-primary btn-play-group" data-id="${group.id}" ${scenarioCount === 0 ? 'disabled' : ''}>▶ Rejouer</button>
          <button class="btn btn-xs btn-secondary btn-rename-group" data-id="${group.id}">✏️</button>
          <button class="btn btn-xs btn-secondary btn-delete-group" data-id="${group.id}">🗑</button>
        </div>
      </div>
    `;
  }).join('');

  elements.groupsList.innerHTML = html;

  // Event listeners
  elements.groupsList.querySelectorAll('.btn-play-group').forEach(btn => {
    btn.addEventListener('click', () => openGroupPlayModal(btn.dataset.id));
  });

  elements.groupsList.querySelectorAll('.btn-rename-group').forEach(btn => {
    btn.addEventListener('click', () => renameGroup(btn.dataset.id));
  });

  elements.groupsList.querySelectorAll('.btn-delete-group').forEach(btn => {
    btn.addEventListener('click', () => deleteGroup(btn.dataset.id));
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

  // Remove group reference from scenarios
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

  elements.groupScenariosList.innerHTML = groupScenarios.map(s => `
    <div class="scenario-check-item">
      <input type="checkbox" id="check-${s.id}" data-id="${s.id}" checked>
      <label for="check-${s.id}">${escapeHtml(s.Name)} (${s.Commands.length} actions)</label>
    </div>
  `).join('');

  elements.groupPlayModal.classList.add('active');
}

elements.groupPlayClose.addEventListener('click', closeGroupPlayModal);
elements.groupPlayCancel.addEventListener('click', closeGroupPlayModal);

function closeGroupPlayModal() {
  elements.groupPlayModal.classList.remove('active');
  state.playingGroupId = null;
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

  // Get scenarios in order
  const scenariosToPlay = checkedIds.map(id => state.scenarios.find(s => s.id === id)).filter(Boolean);
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    showStatus('error', 'Impossible de lancer');
    return;
  }

  // Play scenarios sequentially
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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==================== BACKGROUND SYNC ====================

async function loadCurrentScenario() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_SCENARIO' });
  if (response && response.scenario) {
    // Merge with existing metadata
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
