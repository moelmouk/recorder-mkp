# 🔄 GUIDE DE TEST - Version 2 (XPath avec ID Parent)

## 📋 Changements Apportés

### ✅ Correction Principale : XPath avec ID du Parent

**Avant:**
```json
{
  "cmd": "click",
  "target": "xpath=//ng-select/div[1]/div/div[2]"
}
```

**Après:**
```json
{
  "cmd": "click",
  "target": "xpath=//*[@id="market-place_..."]/ng-select/div/div/div[2]",
  "targetOptions": [
    "xpath=//*[@id="market-place_..."]/ng-select/div/div/div[2]",
    "xpath=//ng-select/div/div/div[2]",
    "css=..."
  ]
}
```

### Fonctionnalités Ajoutées

1. **XPath avec ID Parent** : Cherche le premier ancêtre avec un ID valide
2. **XPath Court** : Génère aussi un XPath relatif court
3. **Tableau Targets** : Exporte plusieurs options de sélecteurs (comme UI Vision)
4. **Format UI Vision** : Export compatible avec le format UI Vision

---

## 🧪 Tests à Effectuer

### Test 1 : Vérification Locale

1. **Recharger le plugin** dans Chrome :
   ```
   chrome://extensions/ → Recharger MKP Recorder
   ```

2. **Ouvrir la page de test** :
   ```
   file:///app/test-xpath-with-parent-id.html
   ```

3. **Vérifier les résultats** :
   - ✅ Test 1 : XPath doit inclure l'ID parent
   - ✅ Test 2 : ID valide doit être capturé
   - ✅ Test 3 : XPath avec ID ancêtre
   - ✅ Test 4 : XPath pour élément profond

4. **Ouvrir la console** (F12) et vérifier :
   ```javascript
   // Tester manuellement
   const el = document.querySelector('[data-test-target]');
   console.log(domUtils.getLocator(el));
   ```

---

### Test 2 : Page APRIL Réelle

#### Étape 1 : Enregistrement

1. Ouvrir : `https://rec1-cloud.april-on.fr/market-place/borrower/client-needs`
2. Ouvrir le dashboard du plugin
3. Créer une nouvelle macro : "Test APRIL v2"
4. Démarrer l'enregistrement
5. Effectuer les actions :
   - Sélectionner "Type de projet"
   - Sélectionner "Nature du projet"
   - Choisir "Particulier"
   - Remplir les champs (Prénom, Nom, Email, etc.)
6. Arrêter l'enregistrement

#### Étape 2 : Vérification des Sélecteurs

**Ouvrir le fichier JSON exporté** et vérifier :

✅ **Attendu** (comme UI Vision) :
```json
{
  "Command": "click",
  "Target": "xpath=//*[@id=\"market-place_borrower_client-needs_project-nature_project-nature_project-type_input-select_0_projectObject\"]/div/div/div[2]",
  "Value": "",
  "Targets": [
    "xpath=//*[@id=\"market-place_borrower_client-needs_project-nature_project-nature_project-type_input-select_0_projectObject\"]/div/div/div[2]",
    "xpath=//ng-select/div/div/div[2]",
    "css=#market-place_borrower_client-needs_project-nature_project-nature_project-type_input-select_0_projectObject > div.ng-select-container > div > div.ng-input"
  ],
  "Description": ""
}
```

❌ **À Éviter** :
```json
{
  "cmd": "click",
  "target": "xpath=//ng-select/div[1]/div/div[2]"
}
```

#### Étape 3 : Comparaison avec UI Vision

Créer un tableau de comparaison :

| Élément | UI Vision | MKP Recorder v2 | Match? |
|---------|-----------|-----------------|--------|
| Select Type | `xpath=//*[@id="market-place_..."]/div/div/div[2]` | ? | ? |
| Select Nature | `xpath=//*[@id="market-place_..."]/div/div/div[2]` | ? | ? |
| Radio Particulier | `id=radio-input_market-place_...` | ? | ? |
| Input Prénom | `id=market-place_..._first-name_...` | ? | ? |
| Checkbox | `xpath=//*[@id="..."]/.../span` | ? | ? |

#### Étape 4 : Test de Relecture

1. Dans le dashboard, cliquer sur "Rejouer"
2. Observer l'exécution :
   - ✅ Tous les éléments doivent être trouvés
   - ✅ Les actions doivent être exécutées correctement
   - ✅ Pas d'erreur "Element not found"

3. Vérifier les logs dans la console (F12) :
   ```
   ✅ MKP Running: click xpath=//*[@id="..."]/.../div[2]
   ✅ Element found and clicked
   ```

---

### Test 3 : Format d'Export

1. Exporter la macro enregistrée
2. Ouvrir le fichier JSON
3. Vérifier le format :

```json
{
  "Name": "Test APRIL v2",
  "CreationDate": "2026-01-02",
  "Commands": [
    {
      "Command": "open",
      "Target": "https://...",
      "Value": "",
      "Targets": [],
      "Description": ""
    },
    {
      "Command": "click",
      "Target": "xpath=//*[@id=\"market-place_...\"]/...",
      "Value": "",
      "Targets": [
        "xpath=//*[@id=\"market-place_...\"]/..",
        "xpath=//ng-select/..",
        "css=..."
      ],
      "Description": ""
    }
  ]
}
```

**Critères de réussite :**
- ✅ Format identique à UI Vision
- ✅ Champ "Targets" présent avec plusieurs options
- ✅ XPath avec ID parent pour les éléments sans ID direct
- ✅ IDs valides capturés directement

---

## 📊 Checklist de Validation

### Phase 1 : Génération des XPath
- [ ] XPath avec ID du parent (format `//*[@id="..."]/...`)
- [ ] XPath court relatif (format `//tag/tag/tag`)
- [ ] ID direct si valide
- [ ] Name si présent
- [ ] CSS Selector
- [ ] Pas de code JavaScript dans les sélecteurs

### Phase 2 : Format d'Export
- [ ] Champs : "Command", "Target", "Value", "Targets", "Description"
- [ ] Tableau "Targets" avec plusieurs options
- [ ] Format compatible UI Vision
- [ ] Date de création au format "YYYY-MM-DD"

### Phase 3 : Fonctionnalité
- [ ] Enregistrement fonctionne
- [ ] Relecture fonctionne
- [ ] Tous les éléments sont trouvés
- [ ] Pas d'erreur "Element not found"
- [ ] Compatible avec les scénarios UI Vision

---

## 🐛 Problèmes Possibles

### Problème 1 : XPath toujours court

**Symptôme :**
```json
"target": "xpath=//ng-select/div/div"
```

**Solution :**
- Vérifier que la fonction `xpath()` est bien modifiée
- Recharger le plugin
- Vider le cache du navigateur

### Problème 2 : Pas de champ "Targets"

**Symptôme :**
```json
{
  "cmd": "click",
  "target": "...",
  "value": ""
}
```

**Solution :**
- Vérifier que `dashboard.js` a été modifié
- Vérifier que `exportMacro()` utilise le nouveau format
- Recharger le plugin

### Problème 3 : Élément non trouvé lors de la relecture

**Symptôme :**
```
❌ Element not found: xpath=...
```

**Solution :**
- Vérifier que le XPath capturé est correct
- Tester le XPath dans la console :
  ```javascript
  $x('//*[@id="market-place_..."]/div/div/div[2]')
  ```
- Si le XPath ne fonctionne pas, c'est que l'ID a changé (page dynamique)

---

## 📝 Rapport de Test

| Test | Résultat | Notes |
|------|----------|-------|
| Test local (test-xpath-with-parent-id.html) | ⬜ ✅ / ❌ | |
| XPath avec ID parent capturé | ⬜ ✅ / ❌ | |
| Champ "Targets" présent | ⬜ ✅ / ❌ | |
| Format compatible UI Vision | ⬜ ✅ / ❌ | |
| Enregistrement sur page APRIL | ⬜ ✅ / ❌ | |
| Relecture fonctionne | ⬜ ✅ / ❌ | |
| Comparaison avec UI Vision | ⬜ ✅ / ❌ | Similarité : ___% |

---

## 🎯 Critères de Succès Final

1. **XPath avec ID parent** : 90%+ des éléments doivent avoir un XPath avec l'ID du parent
2. **Format UI Vision** : Export identique au format UI Vision
3. **Relecture** : 100% des commandes doivent être rejouées sans erreur
4. **Compatibilité** : Les scénarios doivent être interchangeables entre MKP Recorder et UI Vision

---

## 🚀 Si Tous les Tests Passent

Félicitations ! Votre plugin est maintenant **compatible avec UI Vision** et génère des sélecteurs **robustes et précis**.

**Prochaines étapes :**
1. Tester sur d'autres pages web
2. Comparer plus de scénarios avec UI Vision
3. Créer une documentation utilisateur
4. Préparer le package pour distribution
