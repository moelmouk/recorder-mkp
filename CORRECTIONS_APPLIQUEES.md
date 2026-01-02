# Corrections Appliquées au Plugin MKP Recorder

## Date: 2 janvier 2026

## Problème Identifié

Le plugin capturait des **sélecteurs invalides** contenant du code JavaScript au lieu des vrais IDs des éléments DOM.

### Exemple du problème :
- ❌ **Avant** : `id=function r(){if(St(n),n.value===mo){let o=null;throw new C(-950,o)}return n.value}_project-type`
- ✅ **Après** : `id=market-place_borrower_client-needs_project-nature_project-type_input-select_0_projectObject`

## Cause Racine

L'application web APRIL utilise Angular qui génère dynamiquement des IDs dans le DOM. Certains de ces IDs contenaient du code JavaScript, et le plugin les capturait sans validation.

## Solutions Implémentées

### 1. Ajout d'une Fonction de Validation `isValidId()`

```javascript
isValidId(id) {
  if (!id || typeof id !== 'string' || id.length === 0) return false;
  // Rejeter les IDs qui commencent par un chiffre
  if (/^\d/.test(id)) return false;
  // Rejeter les IDs contenant du code JavaScript
  if (/function|{|}|\(.*\).*{|=>|throw|new |if\s*\(|return\s/.test(id)) return false;
  // Rejeter les IDs trop longs (probablement du code)
  if (id.length > 200) return false;
  return true;
}
```

Cette fonction filtre :
- IDs commençant par un chiffre (invalides en CSS)
- IDs contenant des mots-clés JavaScript : `function`, `{`, `}`, `throw`, `return`, `if(`, etc.
- IDs trop longs (> 200 caractères)

### 2. Amélioration de la Fonction `xpath()`

La fonction `xpath()` utilise maintenant `isValidId()` avant d'utiliser un ID :

```javascript
xpath(dom) {
  // ...
  while (current && current.nodeType === 1) {
    const currentId = current.getAttribute('id');
    if (currentId && this.isValidId(currentId)) {  // ✅ Validation ajoutée
      parts.unshift(`*[@id="${currentId}"]`);
      break;
    }
    // ...
  }
}
```

### 3. Ajout de `xpathPosition()` 

Génère un XPath basé sur la position de l'élément dans le DOM (comme UI Vision) :

```javascript
xpathPosition(dom) {
  let path = '';
  let current = dom;
  
  while (current !== null) {
    let currentPath = '/' + this.relativeXPath(current);
    path = currentPath + path;
    const locator = '/' + path;
    
    if (dom === this.getElementByXPath(locator)) {
      return locator;
    }
    current = current.parentNode;
  }
  return null;
}
```

### 4. Ajout de `xpathAttr()`

Génère un XPath basé sur les attributs préférés (id, name, type, value, etc.) :

```javascript
xpathAttr(dom) {
  const PREFERRED_ATTRIBUTES = ['id', 'name', 'value', 'type', 'action', 'onclick'];
  // Génère un XPath comme : //input[@id='test' and @type='text']
}
```

### 5. Ajout de `getFirstWorkingLocator()`

Teste chaque sélecteur candidat et retourne le premier qui fonctionne vraiment :

```javascript
getFirstWorkingLocator(locators, $el) {
  for (let i = 0; i < locators.length; i++) {
    try {
      const $match = this.getElementByLocator(locators[i]);
      if ($el === $match) return locators[i];
    } catch (e) {
      // Continue to next locator
    }
  }
  return null;
}
```

### 6. Amélioration de `getLocator()`

La fonction principale génère maintenant plus de candidats et choisit le meilleur :

```javascript
getLocator($dom) {
  const candidates = [];
  
  // 1. Link Text (pour les liens)
  // 2. ID (seulement si valide ✅)
  // 3. Name
  // 4. XPath standard
  // 5. XPath par attributs
  // 6. XPath par position
  // 7. CSS selector
  
  // Obtenir le premier sélecteur qui fonctionne vraiment
  const chosen = this.getFirstWorkingLocator(candidates, $dom);
  
  return {
    target: chosen || candidates[0] || '',
    targetOptions: candidates
  };
}
```

## Ordre de Priorité des Sélecteurs

1. **Link Text** (pour les liens `<a>`)
2. **ID** (si valide uniquement)
3. **Name** (attribut name)
4. **XPath standard** (chemin complet)
5. **XPath par attributs** (basé sur id, name, type, etc.)
6. **XPath par position** (basé sur la position dans le DOM)
7. **CSS Selector** (sélecteur CSS complet)

## Tests

Un fichier de test HTML a été créé : `/app/test-selector.html`

Ce fichier teste :
- ✅ IDs valides normaux
- ❌ IDs invalides avec code JavaScript
- Éléments sans ID
- IDs commençant par un chiffre
- Éléments avec attribut `name`

## Résultat Attendu

Le plugin devrait maintenant capturer des sélecteurs **identiques ou similaires** à ceux de UI Vision, en évitant complètement les IDs contenant du code JavaScript.

### Comparaison :

| Élément | UI Vision | MKP Recorder (Avant) | MKP Recorder (Après) |
|---------|-----------|----------------------|----------------------|
| Input prénom | `id=market-place_..._first-name_...` | `id=function r(){...}` | `id=market-place_..._first-name_...` ✅ |
| Select projet | `xpath=//*[@id="..."]` | `xpath=/*[@id="function..."]` | `xpath=//*[@id="..."]` ✅ |
| Checkbox | `id=radio-input_market-place_...` | `id=radio-input_function...` | `id=radio-input_market-place_...` ✅ |

## Fichiers Modifiés

- `/app/mkp-recorder-plugin/src/content_script.js` - Fonction `domUtils.getLocator()` et méthodes associées

## Prochaines Étapes

1. Tester le plugin sur la page APRIL : `https://rec5-www.april-on.fr/home`
2. Enregistrer un nouveau scénario et comparer avec UI Vision
3. Vérifier que tous les sélecteurs capturés sont valides
4. Tester la relecture du scénario capturé

## Notes Techniques

- Le plugin utilise maintenant la même logique de validation que UI Vision
- Les sélecteurs invalides sont automatiquement ignorés
- Plusieurs sélecteurs alternatifs sont générés pour chaque élément
- Le premier sélecteur qui fonctionne est utilisé
