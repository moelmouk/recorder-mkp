# MKP Auto Recorder v2.0

Extension Chrome RPA avec gestion de scénarios, groupes et timing réel.

## 🆕 Version 2.0.0 - Nouvelles fonctionnalités

### 📁 Gestion des scénarios
- **Sauvegarde multiple** : Créez et sauvegardez plusieurs scénarios
- **Recherche et filtrage** : Retrouvez facilement vos scénarios
- **Import/Export** : Exportez un ou tous vos scénarios en JSON

### 📂 Groupes
- **Organisation** : Regroupez vos scénarios par projet ou fonctionnalité
- **Lecture de groupe** : Rejouez plusieurs scénarios d'un groupe en séquence
- **Sélection flexible** : Choisissez les scénarios à exécuter dans le groupe

### ⏱️ Timing réel
- **Capture du timing** : Le délai réel entre chaque action est enregistré
- **Lecture miroir** : Reproduisez exactement le comportement utilisateur
- **Gestion des attentes serveur** : Les délais sont respectés pour les échanges client/serveur

### ✏️ Édition des actions
- **Modification** : Changez la commande, target, valeur et timing
- **Suppression** : Retirez les actions inutiles
- **Visualisation** : Voyez le timing de chaque action

### 🎨 Design moderne et léger
- Interface épurée avec thème clair
- Navigation par onglets (Enregistreur, Scénarios, Groupes)
- Indicateurs visuels modernes

## Installation

1. Ouvrir Chrome et aller à `chrome://extensions/`
2. Activer le **Mode développeur** (en haut à droite)
3. Cliquer sur **Charger l'extension non empaquetée**
4. Sélectionner le dossier `/app/mkp-auto-recorder`

## Utilisation

### Onglet Enregistreur

1. Entrez un nom pour votre scénario
2. Sélectionnez un groupe (optionnel)
3. Cliquez sur **● Enregistrer**
4. Effectuez vos actions sur la page
5. Cliquez sur **■ Arrêter**
6. Cliquez sur **💾 Sauvegarder** pour conserver le scénario

### Onglet Scénarios

- **Rechercher** : Filtrez par nom ou groupe
- **Charger** : Chargez un scénario dans l'enregistreur
- **Exporter** : Téléchargez le scénario en JSON
- **Importer** : Chargez un fichier JSON

### Onglet Groupes

- **Créer** : Ajoutez un nouveau groupe
- **Rejouer** : Lancez tous les scénarios du groupe
- **Renommer/Supprimer** : Gérez vos groupes

### Options de lecture

- **Timing réel** : Cochez pour respecter les délais originaux
- **Sans timing** : Exécution rapide avec délai minimum

## Format des scénarios

```json
{
  "id": "lxyz123abc",
  "Name": "Mon scénario",
  "CreationDate": "2025-01-15",
  "groupId": "group123",
  "Commands": [
    {
      "Command": "click",
      "Target": "id=monBouton",
      "Value": "",
      "Targets": ["id=monBouton", "xpath=//*[@id='monBouton']"],
      "timing": 1500,
      "timestamp": 1736956800000
    }
  ]
}
```

### Champs des commandes

| Champ | Description |
|-------|-------------|
| `Command` | Type d'action (click, type, select, etc.) |
| `Target` | Sélecteur principal |
| `Value` | Valeur (pour type, select) |
| `Targets` | Sélecteurs de fallback |
| `timing` | Délai avant l'action (ms) |
| `timestamp` | Horodatage de l'enregistrement |

## Commandes supportées

| Commande | Description |
|----------|-------------|
| `click` | Clic sur un élément |
| `type` | Saisie de texte |
| `select` | Sélection dropdown |
| `check` / `uncheck` | Cases à cocher |
| `pause` | Attente (ms) |
| `open` | Navigation URL |
| `waitForVisible` | Attendre un élément |

## Architecture

```
mkp-auto-recorder/
├── manifest.json      # Configuration extension
├── src/
│   ├── background.js  # Service worker
│   ├── content_script.js  # Script de page
│   ├── popup.html     # Interface
│   ├── popup.js       # Logique interface
│   └── styles.css     # Styles modernes
```

## Changelog

### v2.0.0
- ✅ Gestion de scénarios multiples
- ✅ Système de groupes
- ✅ Lecture de groupe
- ✅ Capture du timing réel
- ✅ Édition des actions
- ✅ Design moderne et léger
- ✅ Recherche et filtrage

### v1.1.0
- Persistance de l'état d'enregistrement
- Indicateur visuel sur la page

### v1.0.0
- Version initiale
