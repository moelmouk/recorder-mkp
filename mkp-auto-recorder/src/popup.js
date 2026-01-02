/**
 * MKP Auto Recorder - Popup Script
 * Fixed: proper scenario isolation
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
  await loadState();
  setupTabs();
  setupButtons();
  startPolling();
}

async function loadState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (response && response.state) {
      const state = response.state;
      
      currentScenario = state.currentScenario;
      savedScenarios = state.scenarios || [];
      
      updateUI(state);
    }
  } catch (e) {
    console.error('Load state error:', e);
  }
}

function updateUI(state) {
  updateStatusBar(state);
  updateButtons(state);
  renderCommands();
  
  if (currentScenario) {
    scenarioNameInput.value = currentScenario.Name || 'Nouveau scénario';
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
    const p = state.playback;
    statusText.textContent = `▶️ Lecture ${p.currentIndex + 1}/${p.total}...`;
  } else if (state.playback?.status === 'completed') {
    statusBar.classList.add('idle');
    statusText.textContent = '✅ Lecture terminée';
  } else if (state.playback?.status === 'error') {
    statusBar.classList.add('error');
    statusText.textContent = '❌ ' + (state.playback.error || 'Erreur');
  } else {
    statusBar.classList.add('idle');
    statusText.textContent = '⏸️ Prêt';
  }
}

function updateButtons(state) {
  const hasCommands = currentScenario?.Commands?.length > 0;
  
  if (state.isRecording) {
    btnRecord.disabled = true;
    btnStop.disabled = false;
    btnPlay.disabled = true;
    btnStopPlay.disabled = true;
    progressContainer.style.display = 'none';
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
      
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `tab-${targetTab}`) {
          content.classList.add('active');
        }
      });
      
      if (targetTab === 'scenarios') {
        loadScenarios();
      }
    });
  });
}

// ========== BUTTONS ==========

function setupButtons() {
  // Record
  btnRecord.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const name = scenarioNameInput.value.trim() || 'Nouveau scénario';
    
    // Start recording with scenario name (background will reset everything)
    await chrome.runtime.sendMessage({ 
      type: 'START_RECORDING', 
      tabId: tab.id,
      scenarioName: name
    });
    
    await loadState();
  });

  // Stop
  btnStop.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.runtime.sendMessage({ type: 'STOP_RECORDING', tabId: tab.id });
    await loadState();
  });

  // Play
  btnPlay.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Update name before playing
    if (currentScenario) {
      currentScenario.Name = scenarioNameInput.value.trim() || currentScenario.Name;
      await chrome.runtime.sendMessage({ type: 'SET_SCENARIO', scenario: currentScenario });
    }
    
    await chrome.runtime.sendMessage({ type: 'PLAY_SCENARIO', tabId: tab.id });
    await loadState();
  });

  // Stop Play
  btnStopPlay.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'STOP_PLAYBACK' });
    await loadState();
  });

  // Save
  btnSave.addEventListener('click', async () => {
    const name = scenarioNameInput.value.trim();
    if (!name) {
      alert('Entrez un nom pour le scénario');
      return;
    }
    
    if (!currentScenario?.Commands?.length) {
      alert('Aucune commande à sauvegarder');
      return;
    }
    
    await chrome.runtime.sendMessage({ type: 'SAVE_SCENARIO', name: name });
    await loadScenarios();
    alert('✅ Scénario sauvegardé !');
  });

  // Export
  btnExport.addEventListener('click', async () => {
    if (!currentScenario?.Commands?.length) {
      alert('Aucune commande à exporter');
      return;
    }
    
    const scenario = {
      Name: scenarioNameInput.value.trim() || currentScenario.Name,
      CreationDate: currentScenario.CreationDate,
      Commands: currentScenario.Commands
    };
    
    const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenario.Name}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  });

  // Import
  btnImport.addEventListener('click', () => fileImport.click());

  fileImport.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      
      if (!imported.Commands || !Array.isArray(imported.Commands)) {
        throw new Error('Format invalide: Commands manquant');
      }
      
      // COMPLETELY REPLACE with imported scenario
      const newScenario = {
        Name: imported.Name || 'Scénario importé',
        CreationDate: imported.CreationDate || new Date().toISOString().split('T')[0],
        Commands: imported.Commands // Use as-is
      };
      
      await chrome.runtime.sendMessage({ type: 'SET_SCENARIO', scenario: newScenario });
      
      // Reload to get the new scenario
      await loadState();
      
      alert(`✅ Importé: ${newScenario.Commands.length} commandes`);
    } catch (error) {
      alert('❌ Erreur: ' + error.message);
    }
    
    fileImport.value = '';
  });

  // Clear
  btnClear.addEventListener('click', async () => {
    if (confirm('Effacer toutes les commandes ?')) {
      await chrome.runtime.sendMessage({ type: 'CLEAR_COMMANDS' });
      await loadState();
    }
  });
}

// ========== COMMANDS ==========

function renderCommands() {
  const commands = currentScenario?.Commands || [];
  commandsCount.textContent = commands.length;
  
  if (commands.length === 0) {
    commandsDiv.innerHTML = `
      <div class="empty-state">
        Aucune commande.<br>
        Cliquez sur <strong>Enregistrer</strong>.
      </div>
    `;
    return;
  }
  
  commandsDiv.innerHTML = commands.map((cmd, i) => `
    <div class="command-item" data-index="${i}">
      <div class="cmd">${i + 1}. ${cmd.Command}</div>
      <div class="target" title="${cmd.Target || ''}">${(cmd.Target || '').substring(0, 60)}...</div>
    </div>
  `).join('');
}

// ========== SCENARIOS ==========

async function loadScenarios() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SCENARIOS' });
    savedScenarios = response.scenarios || [];
    renderScenarios();
  } catch (e) {}
}

function renderScenarios() {
  if (!savedScenarios.length) {
    scenariosList.innerHTML = '<div class="no-scenarios">Aucun scénario sauvegardé.</div>';
    return;
  }
  
  scenariosList.innerHTML = savedScenarios.map((s, i) => `
    <div class="scenario-item">
      <div class="scenario-item-info">
        <div class="scenario-item-name">${s.Name}</div>
        <div class="scenario-item-meta">${s.Commands.length} commandes</div>
      </div>
      <div class="scenario-item-actions">
        <button class="btn-play btn-small" onclick="playScenario(${i})">▶</button>
        <button class="btn-secondary btn-small" onclick="loadScenario(${i})">📝</button>
        <button class="btn-danger btn-small" onclick="deleteScenario(${i})">🗑</button>
      </div>
    </div>
  `).join('');
}

window.loadScenario = async function(index) {
  await chrome.runtime.sendMessage({ type: 'LOAD_SCENARIO', index });
  await loadState();
  
  // Switch to recorder tab
  document.querySelector('[data-tab="recorder"]').click();
};

window.playScenario = async function(index) {
  await chrome.runtime.sendMessage({ type: 'LOAD_SCENARIO', index });
  await loadState();
  document.querySelector('[data-tab="recorder"]').click();
  btnPlay.click();
};

window.deleteScenario = async function(index) {
  const s = savedScenarios[index];
  if (confirm(`Supprimer "${s.Name}" ?`)) {
    await chrome.runtime.sendMessage({ type: 'DELETE_SCENARIO', index });
    await loadScenarios();
  }
};

// ========== POLLING ==========

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  
  pollInterval = setInterval(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      if (response?.state) {
        currentScenario = response.state.currentScenario;
        updateUI(response.state);
        
        // Update progress
        if (response.state.isPlaying && response.state.playback) {
          const p = response.state.playback;
          const pct = ((p.currentIndex + 1) / p.total) * 100;
          progressFill.style.width = `${pct}%`;
          progressText.textContent = `${p.currentIndex + 1} / ${p.total}`;
        }
      }
    } catch (e) {}
  }, 300);
}

window.addEventListener('unload', () => {
  if (pollInterval) clearInterval(pollInterval);
});

// Init
init();
