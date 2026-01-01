# MKP Recorder - Plugin Chrome d'automatisation

Plugin Chrome simplifié pour enregistrer et rejouer des scénarios d'automatisation web, basé sur le code de UI.Vision RPA.

## Fonctionnalités

### Enregistrement
- **click / clickAt** - Clics sur les éléments
- **type** - Saisie de texte
- **select** - Sélection dans les listes déroulantes
- **check / uncheck** - Cases à cocher
- **mouseOver** - Survol de souris
- **dragAndDropToObject** - Glisser-déposer

### Attentes
- **waitForElementPresent** - Attendre qu'un élément existe
- **waitForElementVisible** - Attendre qu'un élément soit visible
- **waitForElementNotPresent** - Attendre qu'un élément disparaisse
- **waitForElementNotVisible** - Attendre qu'un élément soit caché
- **pause** - Pause (en ms)

### Vérifications (non bloquantes)
- **verifyText** - Vérifier le texte d'un élément
- **verifyTitle** - Vérifier le titre de la page
- **verifyValue** - Vérifier la valeur d'un champ
- **verifyElementPresent** - Vérifier la présence d'un élément
- **verifyChecked / verifyNotChecked** - Vérifier l'état d'une case

### Assertions (bloquantes)
- **assertText** - Assertion sur le texte
- **assertTitle** - Assertion sur le titre
- **assertValue** - Assertion sur la valeur
- **assertElementPresent** - Assertion sur la présence
- **assertChecked / assertNotChecked** - Assertion sur l'état

### Stockage de variables
- **storeText** - Stocker le texte d'un élément
- **storeValue** - Stocker la valeur d'un champ
- **storeTitle** - Stocker le titre de la page
- **storeAttribute** - Stocker un attribut
- **store** - Stocker une valeur statique
- **echo** - Afficher dans le journal

### Navigation
- **open** - Ouvrir une URL
- **selectWindow** - Changer d'onglet
- **selectFrame** - Changer de frame

### Contrôle de flux
- **if / else / elseIf / endIf** - Conditions
- **while / endWhile** - Boucles while
- **times / endTimes** - Répéter N fois
- **gotoLabel / label** - Sauts

## Installation

1. Ouvrez Chrome et allez à `chrome://extensions/`
2. Activez le "Mode développeur" en haut à droite
3. Cliquez sur "Charger l'extension non empaquetée"
4. Sélectionnez le dossier `mkp-recorder-plugin`

## Utilisation

1. Cliquez sur l'icône de l'extension pour ouvrir le Dashboard
2. Créez une nouvelle macro avec le bouton "+ Nouveau"
3. Cliquez sur "Enregistrer" pour commencer l'enregistrement
4. Effectuez vos actions sur la page web
5. Cliquez sur "Arrêter" pour terminer l'enregistrement
6. Cliquez sur "Exécuter" pour rejouer le scénario

## Locators supportés

- `id=elementId` - Par ID
- `name=elementName` - Par attribut name
- `css=selector` - Par sélecteur CSS
- `xpath=//expression` - Par XPath
- `linkText=text` - Par texte de lien
- `/direct/xpath` - XPath direct

## Export / Import

- Exportez une macro individuelle ou toutes les macros au format JSON
- Importez des macros depuis un fichier JSON

## Variables

Utilisez `${variableName}` dans les champs target ou value pour référencer des variables stockées.

## Structure du projet

```
mkp-recorder-plugin/
├── manifest.json        # Configuration de l'extension
├── dashboard.html       # Page principale du dashboard
├── css/
│   └── dashboard.css    # Styles du dashboard
├── icons/               # Icônes de l'extension
└── src/
    ├── background.js    # Service worker (gestion centrale)
    ├── content_script.js # Script injecté dans les pages
    ├── dashboard.js     # Logique du dashboard
    └── inject.js        # Script pour le contexte page
```

## Basé sur

Ce plugin est basé sur le code open source de [UI.Vision RPA](https://github.com/nickreynolds/nickreynolds-ui-vision-rpa), simplifié pour ne garder que les fonctionnalités essentielles d'enregistrement et de relecture.

## Licence

GNU AGPL 3.0 (comme le projet original UI.Vision)
