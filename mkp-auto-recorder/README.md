# MKP Auto Recorder

Extension Chrome pour enregistrer et rejouer des actions utilisateur, compatible avec le format UI Vision.

## 🆕 Version 1.1.0 - Améliorations majeures

### Persistance de l'état d'enregistrement
- **L'état d'enregistrement est maintenant persistant** : Quand vous basculez vers une autre page pendant l'enregistrement, l'enregistrement continue !
- Le plugin ne "perd" plus son état quand le popup se ferme
- Le content script est automatiquement ré-injecté lors de la navigation

### Indicateurs visuels
1. **Badge sur l'icône de l'extension**
   - `REC` (rouge) : Enregistrement en cours
   - `▶` (bleu) : Lecture en cours
   - Vide : Prêt

2. **Overlay flottant sur la page**
   - Indicateur rouge visible en haut à droite : "🔴 Enregistrement en cours"
   - Compteur de commandes en temps réel
   - Animation pulsante pour indiquer l'activité
   - Surbrillance des éléments lors de l'enregistrement

### Interface améliorée
- Design modernisé avec dégradés et ombres
- Animations fluides
- Meilleur feedback visuel sur les actions
- Affichage amélioré des commandes enregistrées

## Installation

1. Ouvrir Chrome et aller à `chrome://extensions/`
2. Activer le **Mode développeur** (en haut à droite)
3. Cliquer sur **Charger l'extension non empaquetée**
4. Sélectionner le dossier `/app/mkp-auto-recorder`

## Utilisation

### Enregistrement

1. Naviguer vers la page web que vous voulez automatiser
2. Cliquer sur l'icône de l'extension MKP Auto Recorder
3. Cliquer sur **▶️ Enregistrer**
4. **L'indicateur rouge "Enregistrement en cours" apparaît sur la page**
5. Effectuer vos actions sur la page (clics, saisies, sélections)
6. **Vous pouvez fermer le popup et naviguer sur d'autres pages - l'enregistrement continue !**
7. Rouvrir le popup et cliquer sur **⏹️ Arrêter** quand vous avez terminé

### Lecture

1. Cliquer sur **▶️ Rejouer** pour exécuter le scénario enregistré
2. Le statut affiche la progression de la lecture
3. L'extension exécute les commandes en séquence avec les sélecteurs de fallback

### Export/Import

- **💾 Exporter** : Télécharge le scénario au format JSON compatible UI Vision
- **📥 Importer** : Charge un scénario JSON existant
- **🗑️ Effacer** : Supprime le scénario actuel

## Format des scénarios

Les scénarios sont compatibles avec UI Vision et utilisent le format suivant :

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
| `type` | Saisie de texte dans un champ |
| `select` | Sélection dans un menu déroulant |
| `check` | Cocher une case |
| `uncheck` | Décocher une case |
| `open` | Naviguer vers une URL |
| `pause` | Attendre un délai |
| `waitForVisible` | Attendre qu'un élément soit visible |
| `mouseOver` | Survol d'un élément |
| `verifyText` | Vérifier le texte d'un élément |

## Types de sélecteurs

L'extension supporte les types de sélecteurs suivants :

- `id=xxx` - Sélection par ID
- `name=xxx` - Sélection par attribut name
- `xpath=xxx` - Sélection par XPath
- `css=xxx` - Sélection par CSS
- `linkText=xxx` - Sélection par texte de lien

## Architecture

- `manifest.json` - Configuration de l'extension (v1.1.0)
- `src/background.js` - Service worker pour la gestion d'état persistant et la lecture
- `src/content_script.js` - Script injecté pour l'enregistrement, l'exécution et l'indicateur visuel
- `src/popup.html/js` - Interface utilisateur améliorée

## Basé sur

Cette extension utilise la logique de capture et lecture de [UI Vision RPA](https://ui.vision/) pour garantir la compatibilité des scénarios.

## Changelog

### v1.1.0
- ✅ Persistance de l'état d'enregistrement via `chrome.storage.local`
- ✅ Badge "REC" sur l'icône de l'extension pendant l'enregistrement
- ✅ Overlay flottant "Enregistrement en cours" sur la page web
- ✅ Compteur de commandes en temps réel
- ✅ Surbrillance des éléments lors de l'enregistrement
- ✅ Ré-injection automatique du content script lors de la navigation
- ✅ Restauration automatique de l'état du popup
- ✅ Design modernisé de l'interface

### v1.0.0
- Version initiale
