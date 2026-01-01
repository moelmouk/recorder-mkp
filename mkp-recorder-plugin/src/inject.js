/**
 * MKP Recorder - Inject Script
 * Script injecté dans la page pour accéder au contexte de la page
 */

(function() {
  'use strict';
  
  // Ce script est injecté dans le contexte de la page
  // pour pouvoir accéder à window et exécuter du JavaScript
  
  window.__mkpRecorderInject = {
    eval: function(code) {
      try {
        return { success: true, result: eval(code) };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  };
  
  console.log('MKP Recorder inject script loaded');
})();
