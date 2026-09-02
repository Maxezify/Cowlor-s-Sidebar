export default [{
  files: ['**/*.js'],
  languageOptions: {
    ecmaVersion: 2023,
    sourceType: 'script',
    globals: { window:'readonly', document:'readonly', console:'readonly', fetch:'readonly',
      setTimeout:'readonly', clearTimeout:'readonly', setInterval:'readonly', localStorage:'readonly',
      MutationObserver:'readonly', NodeFilter:'readonly', AbortController:'readonly', Intl:'readonly',
      navigator:'readonly', location:'readonly', history:'readonly', URL:'readonly', Response:'readonly',
      requestAnimationFrame:'readonly', Worker:'readonly', Blob:'readonly', TextDecoder:'readonly',
      CSS:'readonly', chrome:'readonly', getComputedStyle:'readonly', XMLHttpRequest:'readonly',
      atob:'readonly', btoa:'readonly', performance:'readonly', Element:'readonly', Node:'readonly',
      // Deux globals standards du navigateur qui manquaient à cette liste, et
      // que no-undef signalait donc à tort : URLSearchParams (buildIframeUrl,
      // content.js) et Request (adblock.js). Disponibles dans un content
      // script comme partout ailleurs.
      URLSearchParams:'readonly', Request:'readonly',
      // setInterval était déjà déclaré plus haut ; seul clearInterval
      // manquait, pour le nettoyage de subsPage.
      clearInterval:'readonly',
      // DOMParser : la seule porte vers un analyseur HTML qui reste dans le
      // rendu, et elle ne reçoit que du balisage écrit dans content.js
      // (cf. noeudStatique). Tout ce qui vient de Twitch passe par
      // textContent ou setAttribute.
      DOMParser:'readonly' }
  },
  linterOptions: { reportUnusedDisableDirectives: true },
  rules: {
    'no-unused-vars': ['warn', { args:'none', varsIgnorePattern:'^_' }],
    'no-undef': 'error',
    'no-unreachable': 'error',
    'no-dupe-keys': 'error',
    'no-dupe-args': 'error',
    'no-duplicate-case': 'error',
    'no-self-compare': 'warn',
    'no-constant-condition': 'warn',
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-fallthrough': 'error',
    'no-cond-assign': 'error',
    'no-sparse-arrays': 'warn',
    'no-func-assign': 'error',
    'no-import-assign': 'error',
    'no-obj-calls': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
    'no-async-promise-executor': 'error',
    'require-atomic-updates': 'warn'
  }
}];
