# MKP Auto Recorder v1.1

Extension Chrome pour enregistrer et rejouer des actions utilisateur, compatible avec le format UI Vision.

## Nouveautés v1.1

- ✅ **Témoin visuel** : Badge rouge "REC" pendant l'enregistrement, vert "▶" pendant la lecture
- ✅ **État persistant** : L'état d'enregistrement est conservé même si vous fermez le popup
- ✅ **Gestion des scénarios** : Sauvegardez et gérez plusieurs scénarios
- ✅ **Interface améliorée** : Onglets pour séparer l'enregistreur et la liste des scénarios
- ✅ **Barre de progression** : Visualisez l'avancement de la lecture

## Installation

1. Ouvrir Chrome et aller à `chrome://extensions/`
2. Activer le **Mode développeur** (en haut à droite)
3. Cliquer sur **Charger l'extension non empaquetée**
4. Sélectionner le dossier `/app/mkp-auto-recorder`

⚠️ **Important** : Si l'extension était déjà chargée, cliquez sur le bouton "Actualiser" pour charger la nouvelle version.

## Utilisation

### Onglet "Enregistreur"

#### Enregistrement
1. Entrez un nom pour votre scénario
2. Cliquez sur **⏺ Enregistrer**
3. Un badge rouge "REC" apparaît sur l'icône de l'extension
4. Effectuez vos actions sur la page (clics, saisies, sélections)
5. Rouvrez le popup et cliquez sur **⏹ Arrêter**

#### Lecture
1. Cliquez sur **▶ Rejouer** pour exécuter le scénario
2. La barre de progression montre l'avancement
3. Un badge vert "▶" apparaît pendant la lecture
4. Cliquez sur **⏹ Stop** pour arrêter la lecture

#### Actions
- **💾 Sauvegarder** : Enregistre le scénario dans la liste
- **📤 Exporter** : Télécharge le scénario en JSON
- **📥 Importer** : Charge un fichier JSON
- **🗑️ Effacer** : Supprime les commandes actuelles

### Onglet "Scénarios"

Liste de tous vos scénarios sauvegardés avec :
- **▶** : Charger et jouer immédiatement
- **📝** : Charger dans l'éditeur
- **🗑** : Supprimer le scénario

## Format des scénarios

Compatible UI Vision :

```json
{
  "Name": "Mon scénario",
  "CreationDate": "2025-01-15",
  "Commands": [
    {
      "Command": "click",
      "Target": "id=monBouton",
      "Value": "",
      "Targets": [
        "id=monBouton",
        "xpath=//*[@id=\"monBouton\"]",
        "css=#monBouton"
      ]
    }
  ]
}
```

## Commandes supportées

| Commande | Description |
|----------|-------------|
| `click` | Clic sur un élément |
| `type` | Saisie de texte |
| `select` | Sélection dans un menu |
| `check/uncheck` | Cases à cocher |
| `open` | Navigation URL |
| `pause` | Attente (ms) |
| `waitForVisible` | Attendre visibilité |
| `mouseOver` | Survol |
| `verifyText` | Vérifier texte |

## Types de sélecteurs

- `id=xxx` - Par ID
- `name=xxx` - Par attribut name
- `xpath=xxx` - Par XPath
- `css=xxx` - Par CSS
- `linkText=xxx` - Par texte de lien

## Architecture

```
mkp-auto-recorder/
├── manifest.json          # Configuration extension
├── icons/                 # Icônes de l'extension
├── src/
│   ├── background.js      # Service worker (état, playback)
│   ├── content_script.js  # Injection (capture, exécution)
│   ├── popup.html         # Interface utilisateur
│   └── popup.js           # Logique du popup
```

## Basé sur

[UI Vision RPA](https://ui.vision/) pour la compatibilité des scénarios.
