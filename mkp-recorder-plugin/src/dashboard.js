/**
 * MKP Recorder - Dashboard Script
 * Interface utilisateur principale
 */

// ==================== ÉTAT GLOBAL ====================

const appState = {
  macros: [],
  currentMacro: null,
  currentMacroIndex: -1,
  selectedCommandIndex: -1,
  editingCommandIndex: -1,
  status: 'NORMAL', // NORMAL, RECORDING, PLAYING, PAUSED
  playingIndex: -1,
  variables: {},
  playSpeed: 1000
};

// ==================== STOCKAGE ====================

const storage = {
  async getMacros() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['macros'], (result) => {
        resolve(result.macros || []);
      });
    });
  },

  async saveMacros(macros) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ macros }, resolve);
    });
  },

  async exportMacro(macro) {
    const blob = new Blob([JSON.stringify(macro, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${macro.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async exportAllMacros(macros) {
    const blob = new Blob([JSON.stringify(macros, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mkp-recorder-macros-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async importMacros(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(Array.isArray(data) ? data : [data]);
        } catch (error) {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
};

// ==================== INTERFACE UTILISATEUR ====================

const ui = {
  // Éléments DOM
  elements: {},

  init() {
    this.cacheElements();
    this.bindEvents();
    this.loadMacros();
    this.initBackgroundConnection();
  },

  cacheElements() {
    this.elements = {
      macroList: document.getElementById('macro-list'),
      commandsBody: document.getElementById('commands-body'),
      currentMacroName: document.getElementById('current-macro-name'),
      logContent: document.getElementById('log-content'),
      commandEditor: document.getElementById('command-editor'),
      editCommand: document.getElementById('edit-command'),
      editTarget: document.getElementById('edit-target'),
      editValue: document.getElementById('edit-value'),
      playSpeed: document.getElementById('play-speed'),
      btnRecord: document.getElementById('btn-record'),
      btnPlay: document.getElementById('btn-play'),
      btnPause: document.getElementById('btn-pause'),
      btnStop: document.getElementById('btn-stop'),
      btnStep: document.getElementById('btn-step'),
      modalNewMacro: document.getElementById('modal-new-macro'),
      newMacroName: document.getElementById('new-macro-name'),
      importFile: document.getElementById('import-file')
    };
  },

  bindEvents() {
    // Toolbar buttons
    this.elements.btnRecord.addEventListener('click', () => this.toggleRecording());
    this.elements.btnPlay.addEventListener('click', () => this.startPlaying());
    this.elements.btnPause.addEventListener('click', () => this.pausePlaying());
    this.elements.btnStop.addEventListener('click', () => this.stopPlaying());
    this.elements.btnStep.addEventListener('click', () => this.stepPlaying());

    // Speed selector
    this.elements.playSpeed.addEventListener('change', (e) => {
      appState.playSpeed = parseInt(e.target.value, 10);
    });

    // Macro list buttons
    document.getElementById('btn-new-macro').addEventListener('click', () => this.showNewMacroModal());
    document.getElementById('btn-import').addEventListener('click', () => this.elements.importFile.click());
    document.getElementById('btn-export-all').addEventListener('click', () => this.exportAllMacros());

    // Modal buttons
    document.getElementById('btn-create-macro').addEventListener('click', () => this.createMacro());
    document.getElementById('btn-cancel-new-macro').addEventListener('click', () => this.hideNewMacroModal());

    // Command editor buttons
    document.getElementById('btn-add-command').addEventListener('click', () => this.addNewCommand());
    document.getElementById('btn-save-command').addEventListener('click', () => this.saveCommand());
    document.getElementById('btn-cancel-edit').addEventListener('click', () => this.cancelEdit());
    document.getElementById('btn-find').addEventListener('click', () => this.findElement());

    // Import file
    this.elements.importFile.addEventListener('change', (e) => this.importMacros(e));

    // Clear log
    document.getElementById('btn-clear-log').addEventListener('click', () => this.clearLog());

    // Modal backdrop click
    this.elements.modalNewMacro.addEventListener('click', (e) => {
      if (e.target === this.elements.modalNewMacro) {
        this.hideNewMacroModal();
      }
    });

    // Enter key on new macro name
    this.elements.newMacroName.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.createMacro();
      }
    });
  },

  initBackgroundConnection() {
    // Inform background that dashboard is open
    chrome.runtime.sendMessage({ type: 'DASHBOARD_INIT' });

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message);
      sendResponse({ received: true });
      return true;
    });
  },

  handleBackgroundMessage(message) {
    const { type, data } = message;
    
    switch (type) {
      case 'RECORD_ADD_COMMAND':
        this.addRecordedCommand(data);
        break;
    }
  },

  // ==================== MACRO MANAGEMENT ====================

  async loadMacros() {
    appState.macros = await storage.getMacros();
    this.renderMacroList();
    
    if (appState.macros.length > 0) {
      this.selectMacro(0);
    }
  },

  renderMacroList() {
    const html = appState.macros.map((macro, index) => `
      <li class="macro-item ${index === appState.currentMacroIndex ? 'active' : ''}" data-index="${index}">
        <span class="macro-item-name">${macro.name}</span>
        <div class="macro-item-actions">
          <button class="btn-rename" title="Renommer">✏️</button>
          <button class="btn-export" title="Exporter">📥</button>
          <button class="btn-delete" title="Supprimer">🗑️</button>
        </div>
      </li>
    `).join('');
    
    this.elements.macroList.innerHTML = html;

    // Bind macro item events
    this.elements.macroList.querySelectorAll('.macro-item').forEach((item) => {
      const index = parseInt(item.dataset.index, 10);
      
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.macro-item-actions')) {
          this.selectMacro(index);
        }
      });

      item.querySelector('.btn-rename').addEventListener('click', () => this.renameMacro(index));
      item.querySelector('.btn-export').addEventListener('click', () => this.exportMacro(index));
      item.querySelector('.btn-delete').addEventListener('click', () => this.deleteMacro(index));
    });
  },

  selectMacro(index) {
    appState.currentMacroIndex = index;
    appState.currentMacro = appState.macros[index];
    appState.selectedCommandIndex = -1;
    
    this.elements.currentMacroName.textContent = appState.currentMacro?.name || 'Sélectionnez une macro';
    this.renderMacroList();
    this.renderCommands();
    this.hideCommandEditor();
  },

  showNewMacroModal() {
    this.elements.newMacroName.value = '';
    this.elements.modalNewMacro.classList.add('visible');
    this.elements.newMacroName.focus();
  },

  hideNewMacroModal() {
    this.elements.modalNewMacro.classList.remove('visible');
  },

  async createMacro() {
    const name = this.elements.newMacroName.value.trim();
    if (!name) {
      this.log('Veuillez entrer un nom pour la macro', 'warning');
      return;
    }

    const newMacro = {
      id: Date.now().toString(),
      name,
      commands: [],
      createdAt: new Date().toISOString()
    };

    appState.macros.push(newMacro);
    await storage.saveMacros(appState.macros);
    
    this.hideNewMacroModal();
    this.renderMacroList();
    this.selectMacro(appState.macros.length - 1);
    this.log(`Macro "${name}" créée`, 'success');
  },

  async renameMacro(index) {
    const macro = appState.macros[index];
    const newName = prompt('Nouveau nom:', macro.name);
    
    if (newName && newName.trim()) {
      macro.name = newName.trim();
      await storage.saveMacros(appState.macros);
      this.renderMacroList();
      
      if (index === appState.currentMacroIndex) {
        this.elements.currentMacroName.textContent = macro.name;
      }
      
      this.log(`Macro renommée en "${macro.name}"`, 'success');
    }
  },

  async deleteMacro(index) {
    const macro = appState.macros[index];
    if (!confirm(`Supprimer la macro "${macro.name}" ?`)) return;

    appState.macros.splice(index, 1);
    await storage.saveMacros(appState.macros);

    if (appState.currentMacroIndex === index) {
      appState.currentMacroIndex = -1;
      appState.currentMacro = null;
      this.elements.currentMacroName.textContent = 'Sélectionnez une macro';
      this.renderCommands();
    } else if (appState.currentMacroIndex > index) {
      appState.currentMacroIndex--;
    }

    this.renderMacroList();
    this.log(`Macro "${macro.name}" supprimée`, 'info');
  },

  exportMacro(index) {
    const macro = appState.macros[index];
    storage.exportMacro(macro);
    this.log(`Macro "${macro.name}" exportée`, 'success');
  },

  exportAllMacros() {
    if (appState.macros.length === 0) {
      this.log('Aucune macro à exporter', 'warning');
      return;
    }
    storage.exportAllMacros(appState.macros);
    this.log(`${appState.macros.length} macro(s) exportée(s)`, 'success');
  },

  async importMacros(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const imported = await storage.importMacros(file);
      
      for (const macro of imported) {
        if (!macro.name) macro.name = 'Imported Macro';
        if (!macro.commands) macro.commands = [];
        macro.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        appState.macros.push(macro);
      }

      await storage.saveMacros(appState.macros);
      this.renderMacroList();
      this.log(`${imported.length} macro(s) importée(s)`, 'success');
    } catch (error) {
      this.log(`Erreur d'importation: ${error.message}`, 'error');
    }

    e.target.value = '';
  },

  // ==================== COMMAND MANAGEMENT ====================

  renderCommands() {
    if (!appState.currentMacro) {
      this.elements.commandsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">Sélectionnez ou créez une macro</td></tr>';
      return;
    }

    const commands = appState.currentMacro.commands;
    
    if (commands.length === 0) {
      this.elements.commandsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">Aucune commande. Cliquez sur Enregistrer ou ajoutez une commande.</td></tr>';
      return;
    }

    const html = commands.map((cmd, index) => {
      let rowClass = '';
      if (index === appState.playingIndex) rowClass = 'playing';
      if (index === appState.selectedCommandIndex) rowClass = 'selected';
      
      return `
        <tr class="${rowClass}" data-index="${index}">
          <td class="col-num">${index + 1}</td>
          <td class="col-command">${cmd.cmd}</td>
          <td class="col-target target-cell" title="${this.escapeHtml(cmd.target || '')}">${this.escapeHtml(cmd.target || '')}</td>
          <td class="col-value value-cell" title="${this.escapeHtml(cmd.value || '')}">${this.escapeHtml(cmd.value || '')}</td>
          <td class="col-actions">
            <div class="action-btns">
              <button class="btn-edit" title="Éditer">✏️</button>
              <button class="btn-move-up" title="Monter">⬆️</button>
              <button class="btn-move-down" title="Descendre">⬇️</button>
              <button class="btn-delete-cmd" title="Supprimer">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.elements.commandsBody.innerHTML = html;

    // Bind command row events
    this.elements.commandsBody.querySelectorAll('tr').forEach((row) => {
      const index = parseInt(row.dataset.index, 10);
      
      row.addEventListener('click', (e) => {
        if (!e.target.closest('.action-btns')) {
          this.selectCommand(index);
        }
      });

      row.querySelector('.btn-edit')?.addEventListener('click', () => this.editCommand(index));
      row.querySelector('.btn-move-up')?.addEventListener('click', () => this.moveCommand(index, -1));
      row.querySelector('.btn-move-down')?.addEventListener('click', () => this.moveCommand(index, 1));
      row.querySelector('.btn-delete-cmd')?.addEventListener('click', () => this.deleteCommand(index));
    });
  },

  selectCommand(index) {
    appState.selectedCommandIndex = index;
    this.renderCommands();
  },

  addNewCommand() {
    if (!appState.currentMacro) {
      this.log('Sélectionnez d\'abord une macro', 'warning');
      return;
    }

    appState.editingCommandIndex = -1; // New command
    this.elements.editCommand.value = 'click';
    this.elements.editTarget.value = '';
    this.elements.editValue.value = '';
    this.showCommandEditor();
  },

  editCommand(index) {
    const cmd = appState.currentMacro.commands[index];
    appState.editingCommandIndex = index;
    
    this.elements.editCommand.value = cmd.cmd;
    this.elements.editTarget.value = cmd.target || '';
    this.elements.editValue.value = cmd.value || '';
    
    this.showCommandEditor();
  },

  async saveCommand() {
    const cmd = {
      cmd: this.elements.editCommand.value,
      target: this.elements.editTarget.value,
      value: this.elements.editValue.value
    };

    if (appState.editingCommandIndex === -1) {
      // New command
      appState.currentMacro.commands.push(cmd);
    } else {
      // Update existing
      appState.currentMacro.commands[appState.editingCommandIndex] = cmd;
    }

    await storage.saveMacros(appState.macros);
    this.hideCommandEditor();
    this.renderCommands();
    this.log('Commande sauvegardée', 'success');
  },

  cancelEdit() {
    this.hideCommandEditor();
  },

  async moveCommand(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= appState.currentMacro.commands.length) return;

    const commands = appState.currentMacro.commands;
    [commands[index], commands[newIndex]] = [commands[newIndex], commands[index]];

    await storage.saveMacros(appState.macros);
    this.renderCommands();
  },

  async deleteCommand(index) {
    appState.currentMacro.commands.splice(index, 1);
    await storage.saveMacros(appState.macros);
    this.renderCommands();
    this.log('Commande supprimée', 'info');
  },

  addRecordedCommand(cmd) {
    if (!appState.currentMacro) {
      this.log('Créez ou sélectionnez une macro pour enregistrer', 'warning');
      return;
    }

    appState.currentMacro.commands.push({
      cmd: cmd.cmd,
      target: cmd.target || '',
      value: cmd.value || ''
    });

    storage.saveMacros(appState.macros);
    this.renderCommands();
    this.log(`Enregistré: ${cmd.cmd}`, 'info');

    // Scroll to bottom
    const table = this.elements.commandsBody.closest('.commands-container');
    if (table) table.scrollTop = table.scrollHeight;
  },

  showCommandEditor() {
    this.elements.commandEditor.classList.add('visible');
    this.elements.editTarget.focus();
  },

  hideCommandEditor() {
    this.elements.commandEditor.classList.remove('visible');
    appState.editingCommandIndex = -1;
  },

  async findElement() {
    const locator = this.elements.editTarget.value;
    if (!locator) {
      this.log('Entrez un locator pour trouver l\'élément', 'warning');
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: 'HIGHLIGHT_ELEMENT',
        data: { locator }
      });
      this.log('Élément trouvé et surligné', 'success');
    } catch (error) {
      this.log(`Élément non trouvé: ${error.message}`, 'error');
    }
  },

  // ==================== RECORDING ====================

  async toggleRecording() {
    if (appState.status === 'RECORDING') {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  },

  async startRecording() {
    if (!appState.currentMacro) {
      this.log('Créez ou sélectionnez une macro avant d\'enregistrer', 'warning');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({ type: 'START_RECORDING' });
      
      if (response.error) {
        this.log(`Erreur: ${response.error}`, 'error');
        return;
      }

      appState.status = 'RECORDING';
      this.elements.btnRecord.classList.add('recording');
      this.elements.btnRecord.innerHTML = '<span class="icon">⏹</span> Arrêter';
      this.elements.btnPlay.disabled = true;
      
      this.log('Enregistrement démarré...', 'info');
    } catch (error) {
      this.log(`Erreur: ${error.message}`, 'error');
    }
  },

  async stopRecording() {
    try {
      await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
      
      appState.status = 'NORMAL';
      this.elements.btnRecord.classList.remove('recording');
      this.elements.btnRecord.innerHTML = '<span class="icon">⏺</span> Enregistrer';
      this.elements.btnPlay.disabled = false;
      
      this.log('Enregistrement arrêté', 'success');
    } catch (error) {
      this.log(`Erreur: ${error.message}`, 'error');
    }
  },

  // ==================== PLAYING ====================

  async startPlaying() {
    if (!appState.currentMacro || appState.currentMacro.commands.length === 0) {
      this.log('Aucune commande à exécuter', 'warning');
      return;
    }

    appState.status = 'PLAYING';
    appState.playingIndex = 0;
    appState.variables = {};

    this.updatePlayButtons(true);
    this.log('Exécution démarrée...', 'info');

    await chrome.runtime.sendMessage({ type: 'START_PLAYING' });
    
    this.playNextCommand();
  },

  async playNextCommand() {
    if (appState.status !== 'PLAYING') return;
    
    if (appState.playingIndex >= appState.currentMacro.commands.length) {
      this.stopPlaying();
      this.log('Exécution terminée avec succès!', 'success');
      return;
    }

    const command = appState.currentMacro.commands[appState.playingIndex];
    this.renderCommands();
    
    try {
      this.log(`Exécution: ${command.cmd} ${command.target || ''}`, 'info');
      
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Page non valide pour l\'exécution');
      }

      // Handle special commands
      if (command.cmd === 'open') {
        await chrome.tabs.update(tab.id, { url: command.target });
        // Wait for page load
        await this.waitForPageLoad(tab.id);
        await this.delay(500);
      } else if (command.cmd === 'pause') {
        const ms = parseInt(command.target, 10) || parseInt(command.value, 10) || 1000;
        await this.delay(ms);
      } else if (command.cmd === 'echo') {
        this.log(`Echo: ${this.replaceVariables(command.target)}`, 'info');
      } else if (command.cmd === 'store') {
        appState.variables[command.value] = command.target;
      } else if (['if', 'else', 'elseIf', 'endIf', 'while', 'endWhile', 'times', 'endTimes', 'gotoLabel', 'label'].includes(command.cmd)) {
        // Flow control - simplified handling
        this.log(`Contrôle de flux: ${command.cmd} (basique)`, 'warning');
      } else {
        // Send command to content script
        const processedCommand = {
          ...command,
          target: this.replaceVariables(command.target),
          value: this.replaceVariables(command.value)
        };

        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'RUN_COMMAND',
          data: processedCommand
        });

        if (response.error) {
          throw new Error(response.error);
        }

        // Store variables if any
        if (response.vars) {
          Object.assign(appState.variables, response.vars);
        }

        // Handle verify commands (non-fatal)
        if (command.cmd.startsWith('verify') && !response.success) {
          this.log(`Vérification échouée: ${response.error}`, 'warning');
        }
      }

      // Mark as success
      this.markCommandResult(appState.playingIndex, 'success');
      
      appState.playingIndex++;
      
      // Delay between commands
      if (appState.playSpeed > 0) {
        await this.delay(appState.playSpeed);
      }
      
      // Continue if not paused
      if (appState.status === 'PLAYING') {
        this.playNextCommand();
      }
      
    } catch (error) {
      this.log(`Erreur: ${error.message}`, 'error');
      this.markCommandResult(appState.playingIndex, 'error');
      
      if (command.cmd.startsWith('assert')) {
        // Assertions are fatal
        this.stopPlaying();
      } else {
        // Continue on other errors
        appState.playingIndex++;
        if (appState.status === 'PLAYING') {
          this.playNextCommand();
        }
      }
    }
  },

  pausePlaying() {
    if (appState.status === 'PLAYING') {
      appState.status = 'PAUSED';
      this.elements.btnPause.innerHTML = '<span class="icon">▶</span> Reprendre';
      this.elements.btnStep.disabled = false;
      this.log('Exécution en pause', 'warning');
    } else if (appState.status === 'PAUSED') {
      appState.status = 'PLAYING';
      this.elements.btnPause.innerHTML = '<span class="icon">⏸</span> Pause';
      this.elements.btnStep.disabled = true;
      this.log('Exécution reprise', 'info');
      this.playNextCommand();
    }
  },

  async stepPlaying() {
    if (appState.status === 'PAUSED') {
      appState.status = 'PLAYING';
      await this.playNextCommand();
      if (appState.status === 'PLAYING') {
        appState.status = 'PAUSED';
      }
    }
  },

  stopPlaying() {
    appState.status = 'NORMAL';
    appState.playingIndex = -1;
    
    chrome.runtime.sendMessage({ type: 'STOP_PLAYING' });
    
    this.updatePlayButtons(false);
    this.renderCommands();
    this.log('Exécution arrêtée', 'info');
  },

  updatePlayButtons(isPlaying) {
    this.elements.btnRecord.disabled = isPlaying;
    this.elements.btnPlay.disabled = isPlaying;
    this.elements.btnPause.disabled = !isPlaying;
    this.elements.btnStop.disabled = !isPlaying;
    this.elements.btnStep.disabled = true;
    this.elements.btnPause.innerHTML = '<span class="icon">⏸</span> Pause';
  },

  markCommandResult(index, result) {
    const rows = this.elements.commandsBody.querySelectorAll('tr');
    if (rows[index]) {
      rows[index].className = result;
      setTimeout(() => {
        if (rows[index]) rows[index].className = '';
      }, 2000);
    }
  },

  replaceVariables(str) {
    if (!str) return str;
    return str.replace(/\$\{(\w+)\}/g, (match, varName) => {
      return appState.variables[varName] !== undefined ? appState.variables[varName] : match;
    });
  },

  async waitForPageLoad(tabId, timeout = 30000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === 'complete') {
        return;
      }
      await this.delay(100);
    }
    throw new Error('Timeout waiting for page load');
  },

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // ==================== LOGGING ====================

  log(message, type = 'info') {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${time}] ${message}`;
    
    this.elements.logContent.appendChild(entry);
    this.elements.logContent.scrollTop = this.elements.logContent.scrollHeight;
  },

  clearLog() {
    this.elements.logContent.innerHTML = '';
  },

  // ==================== UTILITIES ====================

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};

// ==================== INITIALISATION ====================

document.addEventListener('DOMContentLoaded', () => {
  ui.init();
});
