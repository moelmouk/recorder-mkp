# PROMPT DE CONTEXTE - Projet MKP Recorder

## À copier/coller pour reprendre le projet avec une autre IA

---

## CONTEXTE DU PROJET

Je travaille sur un plugin Chrome appelé **MKP Recorder** situé dans `/app/mkp-recorder-plugin/`. C'est une version simplifiée extraite du projet open source **UI.Vision RPA** (disponible dans `/app/RPA-master/`).

### Objectif
Créer un plugin Chrome permettant d'**enregistrer les actions utilisateur** (clics, saisies, sélections) sur une page web et de **rejouer ces scénarios automatiquement**.

### Structure actuelle
```
/app/mkp-recorder-plugin/
├── manifest.json           # Manifest V3 Chrome
├── dashboard.html          # Interface utilisateur
├── css/dashboard.css       # Styles (thème sombre)
├── src/
│   ├── background.js       # Service Worker
│   ├── content_script.js   # Script injecté dans les pages
│   ├── dashboard.js        # Logique UI
│   └── inject.js           # Script contexte page
├── icons/                  # Icônes PNG
├── README.md
├── RAPPORT_TECHNIQUE.md    # Documentation technique complète
└── LICENSE
```

### Fonctionnement actuel
1. L'utilisateur clique sur l'icône → ouvre le dashboard
2. Crée une macro et clique "Enregistrer"
3. Va sur une page web et fait ses actions
4. Les clics/saisies sont capturés et envoyés au dashboard
5. Peut rejouer le scénario avec "Exécuter"

---

## ÉTAT ACTUEL DU CODE

### Ce qui fonctionne ✅
- Enregistrement des clics (click)
- Enregistrement des saisies (type)
- Enregistrement des sélections (select)
- Génération des locators (id, name, xpath, css, linkText)
- Exécution des commandes basiques
- Import/Export JSON
- Stockage local (chrome.storage)

### Ce qui est partiellement implémenté ⚠️
- **targetOptions**: Le content_script génère plusieurs alternatives de locators mais l'affichage dans l'éditeur n'est pas finalisé
- **Export UI.Vision**: La fonction existe dans storage mais le bouton dans l'UI n'est pas ajouté
- Commandes de contrôle de flux (if/while/times) - détectées mais non exécutées

### Bug connu 🐛
Dans `content_script.js`, la génération XPath pour les IDs peut produire:
```javascript
// Bug: xpath=/*[@id="..."]  (manque un /)
// Correct: xpath=//*[@id="..."]
```

---

## MODIFICATIONS EN COURS (INTERROMPUES)

J'étais en train d'ajouter ces fonctionnalités quand le timeout est survenu:

### 1. Amélioration des locators dans content_script.js
```javascript
// Ajouter après la fonction xpath():
xpathShort(dom) {
  // Génère un XPath court //*[@id="..."] ou //tag[@name="..."]
}

// Modifier getLocator() pour:
// - Ajouter linkText en premier pour les liens
// - Générer plusieurs alternatives XPath
// - S'assurer que tous les XPath commencent par // ou /
```

### 2. Afficher targetOptions dans l'éditeur (dashboard.js)
```javascript
// Ajouter après editCommand():
showTargetOptions(options) {
  // Créer un <select> avec les alternatives
  // Quand sélectionné, mettre à jour le champ target
}
```

### 3. Export format UI.Vision (dashboard.js)
```javascript
// La fonction storage.exportMacro() accepte déjà un 2ème paramètre:
storage.exportMacro(macro, true); // true = format UI.Vision

// Il faut:
// 1. Ajouter un bouton "📤" dans renderMacroList()
// 2. Ajouter la méthode exportMacroUIVision(index)
```

---

## FICHIERS CLÉS À CONSULTER

1. **`/app/mkp-recorder-plugin/RAPPORT_TECHNIQUE.md`** - Documentation complète
2. **`/app/mkp-recorder-plugin/src/content_script.js`** - Enregistrement & exécution
3. **`/app/mkp-recorder-plugin/src/dashboard.js`** - Interface utilisateur
4. **`/app/mkp-recorder-plugin/src/background.js`** - Coordination

Pour comparer avec l'original UI.Vision:
- `/app/RPA-master/src/ext/content_script/index.js`
- `/app/RPA-master/src/common/inspector.js`

---

## CE QUI RESTE À FAIRE

### Priorité haute
1. ✅ Corriger le bug XPath (`/*[@id=` → `//*[@id=`)
2. ✅ Finaliser l'affichage des targetOptions dans l'éditeur
3. ✅ Ajouter le bouton export format UI.Vision

### Priorité moyenne
4. Améliorer la robustesse de l'exécution (retry si élément non trouvé)
5. Ajouter clickAt (clic avec coordonnées)
6. Implémenter les commandes de contrôle de flux (if/else/while)

### Priorité basse
7. Ajouter sendKeys (simulation touche par touche)
8. Gérer les frames/iframes
9. Ajouter une option de vitesse d'exécution variable

---

## COMMANDES POUR TESTER

```bash
# Voir la structure
ls -la /app/mkp-recorder-plugin/
ls -la /app/mkp-recorder-plugin/src/

# Voir un fichier
cat /app/mkp-recorder-plugin/src/content_script.js

# Recréer le ZIP après modifications
cd /app && zip -r mkp-recorder-plugin.zip mkp-recorder-plugin -x "*.py" -x "*.svg"
```

---

## FORMAT DE COMPARAISON

### Mon plugin génère:
```json
{
  "cmd": "click",
  "target": "id=username",
  "value": "",
  "targetOptions": ["id=username", "xpath=//*[@id=\"username\"]", "css=#username"]
}
```

### UI.Vision génère:
```json
{
  "Command": "click",
  "Target": "id=username",
  "Value": "",
  "Targets": ["id=username", "xpath=//*[@id=\"username\"]", "css=#username"],
  "Description": ""
}
```

L'import/export convertit entre les deux formats automatiquement.

---

## INSTRUCTIONS POUR CONTINUER

1. Lis d'abord le fichier `/app/mkp-recorder-plugin/RAPPORT_TECHNIQUE.md`
2. Consulte les fichiers source dans `/app/mkp-recorder-plugin/src/`
3. Continue les modifications interrompues (section "MODIFICATIONS EN COURS")
4. Teste en rechargeant l'extension dans Chrome
5. Recrée le ZIP une fois terminé

Le projet original UI.Vision est dans `/app/RPA-master/` si tu as besoin de référence.
