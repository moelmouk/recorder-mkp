# RAPPORT DÉTAILLÉ - Plugin MKP Recorder

## 📋 Résumé du Projet

**Nom:** MKP Recorder  
**Type:** Extension Chrome (Manifest V3)  
**Objectif:** Enregistrer et rejouer des scénarios d'automatisation web  
**Base:** Code extrait et simplifié de UI.Vision RPA (open source)  
**Emplacement:** `/app/mkp-recorder-plugin/`

---

## 📁 Structure des Fichiers

```
mkp-recorder-plugin/
├── manifest.json           # Configuration extension Chrome (Manifest V3)
├── dashboard.html          # Page principale de l'interface
├── README.md               # Documentation utilisateur
├── LICENSE                 # GNU AGPL 3.0
├── css/
│   └── dashboard.css       # Styles (thème sombre moderne)
├── icons/
│   ├── icon16.png          # Icône 16x16
│   ├── icon48.png          # Icône 48x48
│   └── icon128.png         # Icône 128x128
└── src/
    ├── background.js       # Service Worker (gestion centrale)
    ├── content_script.js   # Script injecté dans les pages web
    ├── dashboard.js        # Logique de l'interface utilisateur
    └── inject.js           # Script pour le contexte de la page
```

---

## 🔧 Architecture Technique

### 1. Background Script (`src/background.js`)
- **Rôle:** Coordonnateur central de l'extension
- **Type:** Service Worker (Manifest V3)
- **Fonctions principales:**
  - Gérer l'état global (NORMAL, RECORDING, PLAYING)
  - Ouvrir le dashboard quand on clique sur l'icône
  - Relayer les messages entre content scripts et dashboard
  - Mettre à jour le badge de l'extension (R=Recording, P=Playing)
  - Gérer les changements d'onglets pendant l'enregistrement

### 2. Content Script (`src/content_script.js`)
- **Rôle:** Interagir avec les pages web
- **Injection:** Automatique sur toutes les URLs
- **Modules internes:**
  - `domUtils`: Utilitaires DOM (XPath, CSS selectors, locators)
  - `recorder`: Capture des événements (click, change, focus)
  - `commandRunner`: Exécution des commandes enregistrées

### 3. Dashboard (`dashboard.html` + `src/dashboard.js`)
- **Rôle:** Interface utilisateur principale
- **Fonctionnalités:**
  - Gestion des macros (CRUD)
  - Tableau des commandes avec édition
  - Contrôles de lecture (Play, Pause, Stop, Step)
  - Journal des événements
  - Import/Export JSON

---

## 📊 Comparaison avec UI.Vision

| Fonctionnalité | UI.Vision | MKP Recorder | Status |
|----------------|-----------|--------------|--------|
| Enregistrement click | ✅ | ✅ | OK |
| Enregistrement type | ✅ | ✅ | OK |
| Enregistrement select | ✅ | ✅ | OK |
| Multiple locators (Targets) | ✅ | ✅ | OK |
| linkText locator | ✅ | ✅ | OK |
| Export format UI.Vision | ✅ | ✅ | OK |
| Import format UI.Vision | ✅ | ✅ | OK |
| Commandes de contrôle (if/while) | ✅ | ⚠️ Basique | À améliorer |
| Vision/OCR | ✅ | ❌ | Non implémenté |
| Screenshots | ✅ | ❌ | Non implémenté |
| XModules | ✅ | ❌ | Non implémenté |

---

## 🔍 Format des Données

### Format Natif MKP Recorder
```json
{
  "id": "1767306725708",
  "name": "ma-macro",
  "commands": [
    {
      "cmd": "open",
      "target": "https://example.com",
      "value": "",
      "targetOptions": []
    },
    {
      "cmd": "click",
      "target": "id=username",
      "value": "",
      "targetOptions": [
        "id=username",
        "name=username",
        "xpath=//*[@id=\"username\"]",
        "css=#username"
      ]
    }
  ],
  "createdAt": "2026-01-01T22:32:05.708Z"
}
```

### Format UI.Vision (compatible import/export)
```json
{
  "Name": "ma-macro",
  "CreationDate": "2026-1-1",
  "Commands": [
    {
      "Command": "open",
      "Target": "https://example.com",
      "Value": "",
      "Targets": [],
      "Description": ""
    },
    {
      "Command": "click",
      "Target": "id=username",
      "Value": "",
      "Targets": [
        "id=username",
        "xpath=//*[@id=\"username\"]",
        "css=#username"
      ],
      "Description": ""
    }
  ]
}
```

---

## ✅ Commandes Supportées

### Actions
| Commande | Description | Target | Value |
|----------|-------------|--------|-------|
| `open` | Ouvrir une URL | URL | - |
| `click` | Cliquer sur un élément | locator | - |
| `type` | Saisir du texte | locator | texte |
| `select` | Sélectionner dans une liste | locator | label=X / value=X / index=X |
| `check` | Cocher une case | locator | - |
| `uncheck` | Décocher une case | locator | - |
| `mouseOver` | Survoler un élément | locator | - |

### Attentes
| Commande | Description |
|----------|-------------|
| `waitForElementPresent` | Attendre qu'un élément existe |
| `waitForElementVisible` | Attendre qu'un élément soit visible |
| `waitForElementNotPresent` | Attendre qu'un élément disparaisse |
| `pause` | Pause en millisecondes |

### Vérifications (non bloquantes)
| Commande | Description |
|----------|-------------|
| `verifyText` | Vérifier le texte d'un élément |
| `verifyTitle` | Vérifier le titre de la page |
| `verifyValue` | Vérifier la valeur d'un champ |

### Assertions (bloquantes)
| Commande | Description |
|----------|-------------|
| `assertText` | Assertion sur le texte |
| `assertTitle` | Assertion sur le titre |

### Variables
| Commande | Description |
|----------|-------------|
| `storeText` | Stocker le texte d'un élément |
| `storeValue` | Stocker la valeur d'un champ |
| `storeTitle` | Stocker le titre |
| `echo` | Afficher dans le journal |

---

## 🐛 Problèmes Connus / À Corriger

### Bug identifié (non corrigé suite au timeout)
Le dernier XPath généré pour les éléments avec `@id` peut parfois être incorrect:
```
xpath=/*[@id="help-id"]  ❌ (manque un /)
xpath=//*[@id="help-id"] ✅ (correct)
```

### Améliorations en cours (interrompues)
1. Ajout du bouton export format UI.Vision
2. Affichage des targetOptions dans l'éditeur
3. Amélioration de la génération XPath

---

## 🔄 Flux de Communication

```
┌─────────────┐     messages     ┌──────────────┐
│  Dashboard  │ ◄──────────────► │  Background  │
│ (dashboard) │                  │  (service    │
└─────────────┘                  │   worker)    │
                                 └──────┬───────┘
                                        │
                                        │ messages
                                        │
                                 ┌──────▼───────┐
                                 │   Content    │
                                 │   Script     │
                                 │ (page web)   │
                                 └──────────────┘
```

### Messages principaux
- `DASHBOARD_INIT` - Dashboard prêt
- `START_RECORDING` / `STOP_RECORDING` - Contrôle enregistrement
- `CS_RECORD_COMMAND` - Commande enregistrée par le content script
- `RECORD_ADD_COMMAND` - Ajouter commande au dashboard
- `RUN_COMMAND` - Exécuter une commande
- `SET_STATUS` - Changer le status du content script

---

## 📝 Notes d'Implémentation

### Génération des Locators
L'ordre de priorité pour générer un locator:
1. `linkText` (pour les liens)
2. `id` (si non numérique)
3. `name`
4. `xpath` avec ID (`//*[@id="..."]`)
5. `xpath` complet (`/html/body/...`)
6. `css` selector

### Stockage
- Utilise `chrome.storage.local`
- Clé: `macros` (tableau de macros)
- Sauvegarde automatique après chaque modification

---

## 🚀 Installation & Test

1. Ouvrir `chrome://extensions/`
2. Activer "Mode développeur"
3. "Charger l'extension non empaquetée"
4. Sélectionner `/app/mkp-recorder-plugin`

Pour recharger après modification:
- Cliquer sur l'icône de rechargement dans chrome://extensions/

---

## 📅 Historique des Modifications

| Date | Modification |
|------|--------------|
| Initial | Création du plugin basé sur UI.Vision |
| v1.1 | Correction communication dashboard/background |
| v1.2 | Ajout linkText, amélioration XPath |
| v1.3 (partiel) | Compatibilité format UI.Vision, targetOptions |

