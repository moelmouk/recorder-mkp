/**
 * MKP Auto Recorder - Popup Script
 * Manages UI and communicates with background script
 */

// DOM Elements
const statusBar = document.getElementById('statusBar');
const statusText = document.getElementById('statusText');
const scenarioNameInput = document.getElementById('scenarioName');
const commandsDiv = document.getElementById('commands');
const commandsCount = document.getElementById('commandsCount');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const scenariosList = document.getElementById('scenariosList');

// Buttons
const btnRecord = document.getElementById('btnRecord');
const btnStop = document.getElementById('btnStop');
const btnPlay = document.getElementById('btnPlay');
const btnStopPlay = document.getElementById('btnStopPlay');
const btnSave = document.getElementById('btnSave');
const btnExport = document.getElementById('btnExport');
const btnImport = document.getElementById('btnImport');
const btnClear = document.getElementById('btnClear');
const fileImport = document.getElementById('fileImport');

// Tabs
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Local state
let currentScenario = null;
let savedScenarios = [];
let pollInterval = null;

// ========== INITIALIZATION ==========

async function init() {
  // Load state from background
  await loadState();
  
  // Setup event listeners
  setupTabs();
  setupButtons();
  
  // Start polling if recording or playing
  startPolling();
}

async function loadState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (response && response.state) {
      const state = response.state;
      
      currentScenario = state.currentScenario;
      savedScenarios = state.scenarios || [];
      
      // Update UI based on state
      updateStatusBar(state);
      updateButtons(state);
      renderCommands();
      renderScenarios();
      
      if (currentScenario) {
        scenarioNameInput.value = currentScenario.Name || 'Nouveau scénario';
      }
    }
  } catch (e) {
    console.error('Error loading state:', e);
  }
}

// ========== STATUS BAR ==========

function updateStatusBar(state) {
  statusBar.className = 'status-bar';
  
  if (state.isRecording) {
    statusBar.classList.add('recording');
    statusText.textContent = '🔴 Enregistrement en cours...';
  } else if (state.isPlaying) {
    statusBar.classList.add('playing');
    const progress = state.playback;
    statusText.textContent = `▶️ Lecture ${progress.currentIndex + 1}/${progress.total}...`;
  } else if (state.playback && state.playback.status === 'completed') {
    statusBar.classList.add('idle');
    statusText.textContent = '✅ Lecture terminée';
  } else if (state.playback && state.playback.status === 'error') {
    statusBar.classList.add('error');
    statusText.textContent = '❌ ' + (state.playback.error || 'Erreur');
  } else {
    statusBar.classList.add('idle');
    statusText.textContent = '⏸️ Prêt à enregistrer';
  }
}

function updateButtons(state) {
  const hasCommands = currentScenario && currentScenario.Commands && currentScenario.Commands.length > 0;
  
  if (state.isRecording) {
    btnRecord.disabled = true;
    btnStop.disabled = false;
    btnPlay.disabled = true;
    btnStopPlay.disabled = true;
  } else if (state.isPlaying) {
    btnRecord.disabled = true;
    btnStop.disabled = true;
    btnPlay.disabled = true;
    btnStopPlay.disabled = false;
    progressContainer.style.display = 'block';
  } else {
    btnRecord.disabled = false;
    btnStop.disabled = true;
    btnPlay.disabled = !hasCommands;
    btnStopPlay.disabled = true;
    progressContainer.style.display = 'none';
  }
}

// ========== TABS ==========

function setupTabs() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // Update tab buttons
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update tab content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `tab-${targetTab}`) {
          content.classList.add('active');
        }
      });
      
      // Refresh scenarios list when switching to that tab
      if (targetTab === 'scenarios') {
        loadScenarios();
      }
    });
  });
}

// ========== BUTTONS ==========

function setupButtons() {
  // Record button
  btnRecord.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Update scenario name
    const name = scenarioNameInput.value.trim() || 'Nouveau scénario';
    await chrome.runtime.sendMessage({ type: 'NEW_SCENARIO', name: name });
    
    // Start recording
    await chrome.runtime.sendMessage({ type: 'START_RECORDING', tabId: tab.id });
    
    await loadState();
  });

  // Stop recording button
  btnStop.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.runtime.sendMessage({ type: 'STOP_RECORDING', tabId: tab.id });
    await loadState();
  });

  // Play button
  btnPlay.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Update scenario name before playing
    if (currentScenario) {
      currentScenario.Name = scenarioNameInput.value.trim() || currentScenario.Name;
      await chrome.runtime.sendMessage({ type: 'SET_SCENARIO', scenario: currentScenario });
    }
    
    // Start playback
    await chrome.runtime.sendMessage({ type: 'PLAY_SCENARIO', tabId: tab.id });
    
    await loadState();
  });

  // Stop playback button
  btnStopPlay.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'STOP_PLAYBACK' });
    await loadState();
  });

  // Save button
  btnSave.addEventListener('click', async () => {
    const name = scenarioNameInput.value.trim();
    if (!name) {
      alert('Veuillez entrer un nom pour le scénario');
      return;
    }
    
    if (!currentScenario || !currentScenario.Commands || currentScenario.Commands.length === 0) {
      alert('Aucune commande à sauvegarder');
      return;
    }
    
    await chrome.runtime.sendMessage({ type: 'SAVE_SCENARIO', name: name });
    await loadScenarios();
    alert('✅ Scénario sauvegardé !');
  });

  // Export button
  btnExport.addEventListener('click', async () => {
    if (!currentScenario || !currentScenario.Commands || currentScenario.Commands.length === 0) {
      alert('Aucune commande à exporter');
      return;
    }
    
    const scenario = {
      ...currentScenario,
      Name: scenarioNameInput.value.trim() || currentScenario.Name
    };
    
    const dataStr = JSON.stringify(scenario, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenario.Name}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  });

  // Import button
  btnImport.addEventListener('click', () => {
    fileImport.click();
  });

  fileImport.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      
      if (!imported.Commands || !Array.isArray(imported.Commands)) {
        throw new Error('Format invalide');
      }
      
      currentScenario = {
        Name: imported.Name || 'Scénario importé',
        CreationDate: imported.CreationDate || new Date().toISOString().split('T')[0],
        Commands: imported.Commands
      };
      
      await chrome.runtime.sendMessage({ type: 'SET_SCENARIO', scenario: currentScenario });
      
      scenarioNameInput.value = currentScenario.Name;
      renderCommands();
      await loadState();
      
      alert('✅ Scénario importé !');
    } catch (error) {
      alert('❌ Erreur: ' + error.message);
    }
    
    fileImport.value = '';
  });

  // Clear button
  btnClear.addEventListener('click', async () => {
    if (confirm('Voulez-vous vraiment effacer toutes les commandes ?')) {
      await chrome.runtime.sendMessage({ type: 'CLEAR_SCENARIO' });
      await loadState();
    }
  });
}

// ========== COMMANDS RENDERING ==========

function renderCommands() {
  if (!currentScenario || !currentScenario.Commands || currentScenario.Commands.length === 0) {
    commandsDiv.innerHTML = `
      <div class="empty-state">
        Aucune commande enregistrée.<br>
        Cliquez sur <strong>Enregistrer</strong> pour commencer.
      </div>
    `;
    commandsCount.textContent = '0';
    return;
  }
  
  const commands = currentScenario.Commands;
  commandsCount.textContent = commands.length;
  
  const html = commands.map((cmd, index) => `
    <div class="command-item" data-index="${index}">
      <div class="cmd">${index + 1}. ${cmd.Command}</div>
      <div class="target" title="${cmd.Target || ''}">${cmd.Target || '(aucune cible)'}</div>
    </div>
  `).join('');
  
  commandsDiv.innerHTML = html;
}

function highlightCommand(index) {
  const items = commandsDiv.querySelectorAll('.command-item');
  items.forEach((item, i) => {
    item.classList.toggle('active', i === index);
  });
}

// ========== SCENARIOS LIST ==========

async function loadScenarios() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SCENARIOS' });
    savedScenarios = response.scenarios || [];
    renderScenarios();
  } catch (e) {
    console.error('Error loading scenarios:', e);
  }
}

function renderScenarios() {
  if (!savedScenarios || savedScenarios.length === 0) {
    scenariosList.innerHTML = `
      <div class="no-scenarios">
        Aucun scénario sauvegardé.<br>
        Enregistrez et sauvegardez un scénario.
      </div>
    `;
    return;
  }
  
  const html = savedScenarios.map((scenario, index) => `
    <div class="scenario-item" data-index="${index}">
      <div class="scenario-item-info">
        <div class="scenario-item-name">${scenario.Name}</div>
        <div class="scenario-item-meta">
          ${scenario.Commands.length} commandes • ${scenario.CreationDate || 'Date inconnue'}
        </div>
      </div>
      <div class="scenario-item-actions">
        <button class="btn-play btn-small" onclick="loadAndPlayScenario(${index})">▶</button>
        <button class="btn-secondary btn-small" onclick="loadScenarioToEditor(${index})">📝</button>
        <button class="btn-danger btn-small" onclick="deleteScenario(${index})">🗑</button>
      </div>
    </div>
  `).join('');
  
  scenariosList.innerHTML = html;
}

// Global functions for inline onclick handlers
window.loadScenarioToEditor = async function(index) {
  await chrome.runtime.sendMessage({ type: 'LOAD_SCENARIO', index: index });
  await loadState();
  
  // Switch to recorder tab
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector('[data-tab="recorder"]').classList.add('active');
  tabContents.forEach(c => c.classList.remove('active'));
  document.getElementById('tab-recorder').classList.add('active');
};

window.loadAndPlayScenario = async function(index) {
  await chrome.runtime.sendMessage({ type: 'LOAD_SCENARIO', index: index });
  await loadState();
  
  // Switch to recorder tab and play
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector('[data-tab="recorder"]').classList.add('active');
  tabContents.forEach(c => c.classList.remove('active'));
  document.getElementById('tab-recorder').classList.add('active');
  
  // Trigger play
  btnPlay.click();
};

window.deleteScenario = async function(index) {
  const scenario = savedScenarios[index];
  if (confirm(`Supprimer le scénario "${scenario.Name}" ?`)) {
    await chrome.runtime.sendMessage({ type: 'DELETE_SCENARIO', index: index });
    await loadScenarios();
  }
};

// ========== POLLING ==========

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  
  pollInterval = setInterval(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      if (response && response.state) {
        const state = response.state;
        
        // Update current scenario from state
        currentScenario = state.currentScenario;
        
        // Update UI
        updateStatusBar(state);
        updateButtons(state);
        renderCommands();
        
        // Update progress during playback
        if (state.isPlaying && state.playback) {
          const progress = state.playback;
          const percent = ((progress.currentIndex + 1) / progress.total) * 100;
          progressFill.style.width = `${percent}%`;
          progressText.textContent = `${progress.currentIndex + 1} / ${progress.total}`;
          highlightCommand(progress.currentIndex);
        }
      }
    } catch (e) {
      // Ignore errors during polling
    }
  }, 300);
}

// Cleanup on popup close
window.addEventListener('unload', () => {
  if (pollInterval) clearInterval(pollInterval);
});

// Initialize
init();
