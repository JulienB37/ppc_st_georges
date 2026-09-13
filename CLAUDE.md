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

## Décisions validées par la mesure

Le spike `tools/spikes/resvg-fontkit.mjs` (rejouable) a tranché les trois hypothèses qui conditionnaient le moteur. Résultats sur Anton + Barlow Semi Condensed sous-ensemblées :

| Question                                                      | Résultat                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| resvg-wasm accepte des WOFF2 sous-ensemblés via `fontBuffers` | Oui                                                                                                                 |
| `font-family` + `font-weight` apparient la bonne face         | Oui — 400/500/600/700 rendent distinctement, aucun repli silencieux                                                 |
| L'avance fontkit prédit le rendu resvg                        | Oui — l'encre est 0,4 à 0,8 % en deçà de l'avance sur des chaînes réelles, **et l'avance est toujours un majorant** |
| Temps de rendu                                                | Aperçu 540 px : 14 ms · export 1080 px : 22 ms · 2160 px : 46 ms · encodage PNG : 58 ms                             |
| Poids du `.wasm`                                              | 2,4 Mo brut (chargement paresseux)                                                                                  |

L'avance fontkit peut donc servir de base au moteur de mise en page. Sur une chaîne très courte (« VS ») l'écart monte à 3,7 % : c'est la part proportionnellement plus grande des approches latérales, pas une dérive.

**Piège de nommage des polices.** Au-delà de Regular et Bold, une face Google Fonts encode sa graisse dans le nom de famille hérité (`name 1` = « Barlow Semi Condensed Medium ») et ne publie la vraie famille que dans le nom typographique (`name 16`). fontdb — donc resvg — lit bien `name 16`, l'appariement fonctionne. Mais `tools/build-fonts.mjs` doit préserver les identifiants de noms au sous-ensemblage (`preserveNameIds`), faute de quoi la famille disparaît et resvg retombe en silence sur une police par défaut.

## Polices propriétaires — action en attente

`fonts/` (Arial, Comic Sans MS) contient des polices Microsoft/Monotype **non redistribuables**. Elles ont été **retirées de l'index git** et sont désormais ignorées : elles restent sur le poste pour rejouer `legacy/`, mais ne sont plus publiées.

Elles demeurent en revanche **accessibles dans l'historique**, et le dépôt est public. Les en purger réellement demande une réécriture d'historique (`git filter-repo`) suivie d'un push forcé — décision de l'utilisateur, non prise unilatéralement.

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
