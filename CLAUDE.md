# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ce que fait ce dépôt

Génère l'affiche des rencontres de championnat par équipe du club PP St Georges/Cher, publiée sur Facebook. Refonte en cours : d'un script Bun sans interface vers une application Angular (web + Electron). Le plan directeur est dans `~/.claude/plans/j-ai-cr-er-ce-petit-vectorized-aho.md`.

## Commandes

**Toute commande node/npm/npx passe par le devbox** (`.mmadb` présent) — voir le skill `mmadb-devbox`. `git` et `docker` restent sur l'host.

```bash
mmadb exec "npm run start"        # ng serve app (--host 0.0.0.0, port 4200 exposé)
mmadb exec "npm run build"        # ng build app
mmadb exec "npm run test:ci"      # vitest, tous projets
mmadb exec "npx ng test poster-core --watch=false"   # un seul projet
mmadb exec "npm run lint"
mmadb exec "npm run typecheck"    # tsc -b
mmadb exec "npm run render:legacy"  # rejoue l'ancien script (oracle de comparaison)
```

`mmadb exec` **découpe la commande sur les espaces** : les commandes composées (`cd x && y`) ne fonctionnent pas. Passer par un script npm.

## Architecture

```
Domaine  ──►  Layout  ──►  Émission SVG  ──►  resvg-wasm  ──►  pixels / PNG
(zod)        (positions)   (chaîne)          (worker)         (aperçu + export)
```

- `projects/poster-core/` — **TypeScript pur**. Le même code tourne dans le navigateur, un worker, Node (tests, images de référence) et le renderer Electron. Deux invariants tenus par ESLint (`no-restricted-imports` dans son `eslint.config.js`) : **aucun import Angular**, et **aucun accès au système de fichiers** — les assets arrivent déjà résolus en data URL. C'est précisément ce qui cassait l'ancien script une fois empaqueté.
- `projects/app/` — application Angular 22, standalone, zoneless, signals.
- `legacy/` — l'ancien script Bun, **gelé et volontairement non modifié**. C'est le seul oracle de parité visuelle pendant la refonte ; il sera supprimé au dernier lot. Ses `fonts/` et `images/` sont des liens symboliques vers la racine, ce qui lui évite toute modification de code.
- `tsconfig.json` mappe `poster-core` sur **les sources** (`projects/poster-core/src/public-api.ts`), pas sur `dist/` : aucune étape de build intermédiaire en développement.

## Bugs de l'ancien script (référence, à ne pas reproduire)

Diagnostic complet dans le plan. En résumé :

1. [legacy/index.ts:127](legacy/index.ts#L127) appelle `drawMatchEnfant` **sans `await`** alors que la méthode est asynchrone → la sérialisation `canvas.svg()` survient avant que les images soient insérées, d'où les blocs manquants sur l'affiche jeunes.
2. Les polices sont injectées deux fois et aucun chemin ne fonctionne : resvg **ne lit pas** les `@font-face` base64, et ses `fontFiles` sont des chemins relatifs au cwd, cassés dès que le binaire est lancé d'ailleurs.
3. `drawGroup` accumule `y` sans borne → au-delà de ~8 rencontres le contenu sort du `viewBox` et est **silencieusement rogné**.

## Pièges de l'environnement (déjà rencontrés)

- **npm 10.9.x plante** sur la résolution des peer deps de vitest (`Cannot read properties of null (reading 'edgesOut')` dans arborist). Le devbox et la CI installent **npm 12**.
- **npm 12 bloque les scripts d'installation** par défaut. Les quatre paquets natifs de la chaîne Angular (`esbuild`, `lmdb`, `msgpackr-extract`, `@parcel/watcher`) sont approuvés via le champ `allowScripts` de `package.json` — versionné, donc reproductible en CI.
- Pour la même raison, `bun` n'est **pas** installé via npm dans le devbox : son binaire est copié depuis l'image `oven/bun`.
- TypeScript 6 exige un `rootDir` explicite dès qu'un `outDir` est posé. Tous les `tsconfig.*.json` de projet en ont un, pointant vers `out-tsc/`, sinon `tsc -b` émet du `.js` à côté des sources.

## Conventions

Le code, les commentaires et les messages de commit sont en français. Les identifiants restent sans accents.
