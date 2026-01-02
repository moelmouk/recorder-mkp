# Guide de Test - Plugin MKP Recorder Corrigé

## 🎯 Objectif

Vérifier que le plugin capture maintenant des sélecteurs valides, sans code JavaScript.

## 📋 Prérequis

1. Charger le plugin dans Chrome/Edge :
   - Aller à `chrome://extensions/`
   - Activer "Mode développeur"
   - Cliquer sur "Charger l'extension non empaquetée"
   - Sélectionner le dossier `/app/mkp-recorder-plugin/`

2. Avoir accès à l'URL de test APRIL : `https://rec5-www.april-on.fr/home`

## 🧪 Tests à Effectuer

### Test 1 : Validation Locale (Recommandé en premier)

1. Ouvrir le fichier de test : `file:///app/test-selector.html`
2. Ouvrir la console développeur (F12)
3. Vérifier les résultats affichés pour chaque test :
   - Test 1 : ID valide → Devrait être ✅ accepté
   - Test 2 : ID avec JavaScript → Devrait être ❌ rejeté
   - Test 3 : Sans ID → Devrait utiliser XPath ou CSS
   - Test 4 : ID commence par chiffre → Devrait être ❌ rejeté
   - Test 5 : Avec attribut name → Devrait utiliser `name=...`

### Test 2 : Page APRIL (Test Réel)

#### Étape 1 : Enregistrer un Scénario

1. Ouvrir `https://rec5-www.april-on.fr/home`
2. Ouvrir le dashboard du plugin (clic sur l'icône)
3. Cliquer sur "Démarrer l'enregistrement"
4. Effectuer les actions suivantes sur la page :
   - Cliquer sur un produit
   - Remplir le formulaire (Type de projet, Nature du projet)
   - Sélectionner "Particulier"
   - Remplir "Civilité" (Monsieur)
   - Remplir "Prénom" : `mohamed`
   - Remplir "Nom" : `elmo`
   - Remplir "Email" : `med@gmail.com`
   - Remplir "Téléphone" : `0676767687`
5. Arrêter l'enregistrement

#### Étape 2 : Vérifier les Sélecteurs Capturés

Ouvrir le fichier JSON du scénario enregistré et vérifier :

**✅ ATTENDU (Bon) :**
```json
{
  "cmd": "click",
  "target": "id=market-place_borrower_client-needs_insureds_insureds-container_insured_0_insured-person_first-name_input-text_input"
}
```

**❌ À ÉVITER (Mauvais) :**
```json
{
  "cmd": "click",
  "target": "id=function r(){if(St(n),n.value===mo){let o=null;throw new C(-950,o)}return n.value}_first-name"
}
```

#### Étape 3 : Critères de Succès

Le scénario capturé doit :
- ✅ Ne contenir AUCUN sélecteur avec `function`, `{`, `}`, `throw`, `return`
- ✅ Avoir des IDs similaires à ceux capturés par UI Vision
- ✅ Utiliser `id=` pour les éléments qui ont des IDs valides
- ✅ Utiliser `xpath=` ou `name=` pour les éléments sans ID valide
- ✅ Tous les sélecteurs doivent être dans `targetOptions`

### Test 3 : Relecture du Scénario

1. Après avoir enregistré le scénario, cliquer sur "Rejouer"
2. Vérifier que :
   - ✅ Tous les éléments sont trouvés (pas d'erreur "Element not found")
   - ✅ Les actions sont exécutées correctement
   - ✅ Le formulaire se remplit comme attendu

### Test 4 : Comparaison avec UI Vision

Si vous avez UI Vision installé :

1. Enregistrer le même scénario avec UI Vision
2. Enregistrer le même scénario avec MKP Recorder
3. Comparer les fichiers JSON :

**Exemple de comparaison attendue :**

| Élément | UI Vision | MKP Recorder (Après correction) |
|---------|-----------|--------------------------------|
| Input Prénom | `id=market-place_..._first-name_input-text_input` | `id=market-place_..._first-name_input-text_input` ✅ |
| Select Type | `xpath=//*[@id="market-place_..._projectObject"]/div/div/div[2]` | `xpath=//*[@id="market-place_..._projectObject"]/div/div/div[2]` ✅ |
| Radio Particulier | `id=radio-input_market-place_..._subscriber-type_aon-choice_0` | `id=radio-input_market-place_..._subscriber-type_aon-choice_0` ✅ |

## 📊 Résultats Attendus

### ✅ Succès

- Tous les sélecteurs capturés sont **valides**
- Aucun sélecteur ne contient de code JavaScript
- Le scénario peut être **relu avec succès**
- Les sélecteurs sont **similaires à UI Vision**

### ⚠️ Échec Partiel

Si certains éléments ont encore des sélecteurs invalides :
1. Noter quels éléments posent problème
2. Vérifier les logs de la console (F12)
3. Vérifier que l'ID de l'élément dans le DOM est valide

### ❌ Échec Complet

Si tous les sélecteurs sont encore invalides :
1. Vérifier que le plugin a bien été rechargé dans `chrome://extensions/`
2. Vérifier que le fichier `content_script.js` a bien été modifié
3. Vider le cache du navigateur (Ctrl+Shift+Delete)
4. Redémarrer Chrome

## 🐛 Débogage

### Activer les Logs

Ouvrir la console développeur (F12) et vérifier les logs :

```javascript
// Devrait afficher lors de l'enregistrement
"MKP Recording: {cmd: 'click', target: 'id=...', ...}"

// Ne devrait PAS afficher
"MKP Recording: {cmd: 'click', target: 'id=function r(){...}', ...}"
```

### Inspecter un Élément

1. Faire clic droit sur un élément → "Inspecter"
2. Vérifier l'attribut `id` dans le DOM
3. Tester la validation dans la console :

```javascript
// Dans la console du navigateur
const element = document.querySelector('input[placeholder="Prénom"]');
const id = element.getAttribute('id');
console.log('ID:', id);

// Test de validation
const isValid = !/function|{|}|\(.*\).*{|=>|throw|new |if\s*\(|return\s/.test(id);
console.log('Est valide:', isValid);
```

## 📝 Rapport de Test

Après les tests, noter :

| Test | Statut | Notes |
|------|--------|-------|
| Test local (test-selector.html) | ⬜ ✅ / ❌ | |
| Enregistrement sur page APRIL | ⬜ ✅ / ❌ | |
| Validation des sélecteurs | ⬜ ✅ / ❌ | Nombre d'IDs invalides : ___ |
| Relecture du scénario | ⬜ ✅ / ❌ | Erreurs : ___ |
| Comparaison avec UI Vision | ⬜ ✅ / ❌ | Différences : ___ |

## 🎬 Prochaines Actions

Si tous les tests passent ✅ :
1. Le plugin est prêt à être utilisé en production
2. Créer un package `.zip` pour distribution
3. Mettre à jour la documentation utilisateur

Si des tests échouent ❌ :
1. Noter les problèmes spécifiques
2. Fournir les logs et captures d'écran
3. Ajustements supplémentaires nécessaires
