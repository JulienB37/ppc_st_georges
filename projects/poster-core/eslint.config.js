// @ts-check
const { defineConfig } = require('eslint/config');
const rootConfig = require('../../eslint.config.js');

module.exports = defineConfig([
  ...rootConfig,
  {
    files: ['**/*.ts'],
    rules: {
      /**
       * poster-core est du TypeScript pur : le meme code doit tourner dans un
       * worker, dans Node (tests, golden images) et dans le renderer Electron.
       *
       * - Angular : la librairie serait inutilisable hors application.
       * - node:fs / node:path : la librairie ne lit JAMAIS un fichier. Tous les
       *   assets lui arrivent deja resolus en data URL. C'est precisement ce qui
       *   cassait l'ancien script une fois empaquete (chemins relatifs au cwd).
       */
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@angular/*'],
              message:
                "poster-core doit rester agnostique d'Angular : deplacez ce code dans projects/app.",
            },
            {
              group: ['fs', 'node:fs', 'node:fs/*', 'path', 'node:path', 'url', 'node:url'],
              message:
                "poster-core ne lit jamais le systeme de fichiers : passez l'asset deja resolu (data URL) en parametre.",
            },
          ],
        },
      ],
    },
  },
]);
