# 📹 MKP Auto Recorder

Plugin Chrome d'enregistrement automatique de scénarios, 100% compatible avec le format UI Vision.

## 🎯 Fonctionnalités

- ✅ **Enregistrement automatique** des actions utilisateur (clicks, saisies, sélections)
- ✅ **Format UI Vision** : Export JSON compatible avec UI Vision RPA
- ✅ **Code UI Vision intégré** : Utilise directement le code de génération de sélecteurs de UI Vision
- ✅ **XPath précis** : Remonte jusqu'à l'ID parent le plus proche
- ✅ **Multiple Targets** : Génère plusieurs variantes de sélecteurs (XPath, CSS, ID, etc.)

## 📦 Installation

### 1. Charger le plugin dans Chrome

1. Ouvrir Chrome et aller à : `chrome://extensions/`
2. Activer **Mode développeur** (en haut à droite)
3. Cliquer sur **Charger l'extension non empaquetée**
4. Sélectionner le dossier : `/app/mkp-auto-recorder`

### 2. Vérifier l'installation

- L'icône du plugin devrait apparaître dans la barre d'outils Chrome
- Cliquer dessus pour ouvrir le popup

## 🚀 Utilisation

### Enregistrer un scénario

1. **Ouvrir la page web** à automatiser
2. **Cliquer sur l'icône** du plugin MKP Auto Recorder
3. **Entrer un nom** pour le scénario (optionnel)
4. **Cliquer sur "Démarrer"**
5. **Effectuer les actions** sur la page :
   - Clics sur boutons, liens, etc.
   - Saisie dans les champs texte
   - Sélection dans les dropdowns
   - Cocher/décocher des checkboxes
6. **Cliquer sur "Arrêter"** quand terminé
7. **Exporter** le scénario en JSON

### Format d'export

Le plugin génère un fichier JSON au format UI Vision :

```json
{
  "Name": "Mon scénario",
  "CreationDate": "2026-01-02",
  "Commands": [
    {
      "Command": "click",
      "Target": "xpath=//*[@id=\"element-id\"]/div/button",
      "Value": "",
      "Targets": [
        "xpath=//*[@id=\"element-id\"]/div/button",
        "xpath=//button[@type='submit']",
        "css=#element-id > div > button"
      ],
      "Description": ""
    },
    {
      "Command": "type",
      "Target": "id=username",
      "Value": "test@example.com",
      "Targets": [
        "id=username",
        "xpath=//*[@id=\"username\"]",
        "name=username"
      ],
      "Description": ""
    }
  ]
}
```

## 🔧 Caractéristiques Techniques

### Code source de UI Vision

Le plugin utilise **directement le code** de UI Vision pour la génération des sélecteurs :

- `inspector.js` : Fonctions de génération XPath, CSS
- `relativeXPath()` : Génère le chemin XPath relatif
- `xpath()` : Fonction récursive qui remonte jusqu'à l'ID parent
- `xpathAttr()` : XPath par attributs
- `xpathPosition()` : XPath par position
- `cssSelector()` : Génération CSS Selector

### Ordre de priorité des sélecteurs

1. **ID** : `id=element-id`
2. **Name** : `name=field-name`
3. **Link Text** : `linkText=Click here`
4. **XPath avec ID parent** : `xpath=//*[@id="parent"]/child`
5. **XPath par attributs** : `xpath=//input[@type='text' and @name='email']`
6. **XPath par position** : `xpath=/html/body/div[1]/form/input[2]`
7. **CSS Selector** : `css=#parent > div > input:nth-of-type(2)`

### Événements capturés

- `click` : Tous les clics sur la page
- `change` : Changements dans les champs input, textarea, select
- `type` : Saisie de texte dans les champs
- `check` / `uncheck` : Checkboxes et radio buttons

## 📋 Comparaison avec UI Vision

| Fonctionnalité | UI Vision | MKP Auto Recorder |
|----------------|-----------|-------------------|
| Format JSON | ✅ | ✅ |
| XPath avec ID parent | ✅ | ✅ |
| Multiple Targets | ✅ | ✅ |
| Enregistrement automatique | ✅ | ✅ |
| Relecture (player) | ✅ | ❌ (à venir) |
| Commandes avancées | ✅ | ❌ (à venir) |

## 🐛 Dépannage

### Le plugin ne s'affiche pas
- Vérifier que le "Mode développeur" est activé
- Recharger l'extension : `chrome://extensions/` → Recharger

### L'enregistrement ne fonctionne pas
- Ouvrir la console développeur (F12)
- Vérifier les logs : `MKP Recording started`
- Recharger la page et réessayer

### Les XPath sont incorrects
- Le plugin utilise le même code que UI Vision
- Si UI Vision génère un bon XPath, le plugin devrait faire pareil
- Vérifier dans la console : `MKP Recorded: {...}`

## 📝 Notes

- **Attention** : Ce plugin est en phase de développement
- **Compatibilité** : Chrome, Edge, et navigateurs basés sur Chromium
- **Format** : 100% compatible avec UI Vision RPA

## 🚧 Fonctionnalités à venir

- [ ] Lecture / Relecture des scénarios (player)
- [ ] Import de scénarios UI Vision
- [ ] Édition des commandes enregistrées
- [ ] Support des iframes
- [ ] Commandes avancées (wait, verify, etc.)
- [ ] Variables et paramètres

## 📄 License

Code basé sur UI Vision RPA (GNU AGPL v3.0)
