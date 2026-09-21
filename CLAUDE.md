# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ce que fait ce dépôt

Prépare l'affiche des rencontres de championnat par équipes du club PP St Georges/Cher, publiée sur Facebook.

**La refonte est livrée et le site est en ligne** : <https://julienb37.github.io/ppc_st_georges/>. L'outil est passé d'un script Bun sans interface à une application Angular installable, utilisable hors ligne. `docs/guide.md` l'explique à un bénévole ; le `README.md` s'adresse aux développeurs.

Le plan directeur est dans `~/.claude/plans/j-ai-cr-er-ce-petit-vectorized-aho.md`. **Il a divergé sur trois points**, et c'est le dépôt qui fait foi :

- **Signal Forms** et non Reactive Forms : l'API est stable en Angular 22.1, la raison invoquée par le plan ne tenait plus.
- **Pas d'Electron**, pas de zip de sauvegarde, pas de texte de publication Facebook : retirés du périmètre par l'utilisateur. Ne pas les reproposer.
- Le fond n'est **pas** régénéré en vectoriel : l'utilisateur a fourni son propre gabarit, et le design de l'affiche est **gelé** depuis qu'il l'a validé. Ne pas y toucher sans demande explicite.

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

Deux limites de `mmadb exec`, à connaître avant de s'y fier :

1. Il **découpe la commande sur les espaces** : les commandes composées (`cd x && y`) ne fonctionnent pas. Passer par un script npm.
2. Il **avale le code de sortie** et renvoie toujours 0, même quand la commande échoue (`mmadb exec "false"` rend 0). Une vérification qui se contente de tester `$?` est donc **aveugle aux échecs**.

Pour tout ce qui doit échouer bruyamment — lint, tests, typecheck, vérification d'assets — passer par `docker exec`, qui propage correctement :

```bash
docker exec -u julien -w /home/julien/app mmadb_ping_svg_championat bash -lc "npm run lint"
```

Le `bash -lc` est nécessaire : sans shell de connexion, le `PATH` ne contient pas node et la commande rend 127. La CI, elle, lance npm directement et n'est pas concernée.

## Architecture

```
Domaine  ──►  Layout  ──►  Émission SVG  ──►  resvg-wasm  ──►  pixels / PNG
(zod)        (positions)   (chaîne)          (worker)         (aperçu + export)
```

- `projects/poster-core/` — **TypeScript pur**. Le même code tourne dans le navigateur, un worker et Node (tests, images de référence). Deux invariants tenus par ESLint (`no-restricted-imports` dans son `eslint.config.js`) : **aucun import Angular**, et **aucun accès au système de fichiers** — les assets arrivent déjà résolus en data URL. C'est précisément ce qui cassait l'ancien script une fois empaqueté.
- `projects/app/` — application Angular 22 : standalone, zoneless, signals, **Signal Forms**.
- `legacy/` — l'ancien script Bun, **gelé et volontairement non modifié**. Son rôle d'oracle de parité visuelle **est terminé**, le gabarit du club ayant été validé : il n'attend plus que sa suppression. Ses `fonts/` et `images/` sont des liens symboliques vers la racine, ce qui lui évite toute modification de code.
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

## La composition ne doit jamais échouer sur une saisie incomplète

L'aperçu se redessine **à chaque frappe** : `composerAffiche` voit donc tous les états intermédiaires d'un document qu'on remplit. C'est un contrat, couvert par `render/saisie-en-cours.spec.ts`, et deux défauts l'ont établi :

- un créneau **sans rencontre** — l'état d'un document neuf — donnait un pas de rangée infini, puis des coordonnées non finies. L'utilisateur lisait « Coordonnee non finie dans la scene : NaN » sans avoir rien saisi de faux ;
- une date **à moitié tapée** faisait lever `formatCreneau`, qui est strict à juste titre. Le rendu imprime désormais une attente.

Corollaire : ce qui manque est dit par la **validation du schéma**, jamais par une exception du moteur. `problemesDe` traduit les erreurs zod en phrases situées, et c'est `AfficheSchema` qui reste l'unique référence de validité — y recopier une règle dans le formulaire laisserait passer un document que l'export refuserait.

Dans le même esprit, un **asset introuvable ne fait pas échouer le rendu** : un logo manquant devient un monogramme, un partenaire manquant est omis. Un seul fichier absent emportait toute l'affiche.

## Déploiement — GitHub Pages sous un sous-chemin

Le site est publié par `deploy-web.yml` sur **push sur `master`**, à l'adresse
`https://<compte>.github.io/ppc_st_georges/`. Deux conséquences structurantes,
qui ont déjà cassé le paquet une fois :

1. **Aucun chemin d'asset ne doit être absolu.** `/assets/x` viserait la racine
   du domaine, où il n'y a rien. Le code TypeScript passe par
   `shared/url-asset.ts`, qui résout contre le `<base href>` que le build
   injecte. Les `url()` des feuilles de style, elles, visent le fichier **sur
   disque** (`../public/assets/...`) : le build les vérifie alors, et une police
   renommée casse la compilation au lieu de laisser le navigateur se rabattre en
   silence.
2. **Le routage a besoin d'un repli.** Pages ne connaît pas les routes de
   l'application : le workflow recopie `index.html` en `404.html`. Une route
   profonde rechargée arrive donc en **404**, et l'application démarre quand
   même — c'est vérifié.

Le workflow refuse de publier si le `<base href>` est absent ou si un fichier
dont le rendu dépend manque du paquet.

## PWA — ce que le cache doit contenir

Le service worker n'est pas décoratif : la saisie se fait en salle, avec un wifi
médiocre. Les groupes de `projects/app/ngsw-config.json` découlent d'un constat
mesuré — **une affiche ne se rend pas sans ses logos**. Un groupe `lazy` pour
les logos laissait l'application se charger hors ligne mais échouer au rendu sur
« Failed to fetch ». Ils sont donc en `prefetch`, comme les polices, le gabarit
et les 2,4 Mo de wasm. Seules les icônes du lanceur restent paresseuses : le
système les récupère à l'installation, donc en ligne.

En complément, un asset introuvable ne fait **plus** échouer le rendu entier :
un logo manquant devient un monogramme, un partenaire manquant est omis. Un seul
fichier absent emportait toute l'affiche.

## Polices propriétaires — action en attente

`fonts/` (Arial, Comic Sans MS) contient des polices Microsoft/Monotype **non redistribuables**. Elles ont été **retirées de l'index git** et sont désormais ignorées : elles restent sur le poste pour rejouer `legacy/`, mais ne sont plus publiées.

Elles demeurent en revanche **accessibles dans l'historique**, et le dépôt est public. Les en purger réellement demande une réécriture d'historique (`git filter-repo`) suivie d'un push forcé — décision de l'utilisateur, non prise unilatéralement.

À rappeler quand le sujet revient : **`legacy/` est la seule raison de garder ces polices sur le poste**. Le supprimer rend la purge simple, et son rôle d'oracle est terminé.

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
- `@angular/service-worker` exige la version **exacte** du cœur en peer dep. Installer `^22.1.0` échoue quand `@angular/core` est en 22.1.6 : épingler la même version.
- **Ni `gh` ni assistant d'identifiants Git** sur ce poste : `git push` échoue sur l'authentification. Pousser et ouvrir les PR revient à l'utilisateur — préparer le travail en local, puis lui donner les commandes.
- Le **devbox s'arrête entre deux sessions** : `mmadb start` avant tout le reste, sinon `docker exec` rend « No such container ».
- Le **bac à sable isole le réseau** des appels Bash successifs : un serveur lancé en tâche de fond dans un appel n'est pas joignable depuis le suivant. Pour servir quelque chose à Playwright, passer par le devbox, dont le port 4200 est publié.

## Conventions

Le code, les commentaires et les messages de commit sont en français. Les identifiants restent sans accents.

En revanche, **tout texte lu par un utilisateur porte ses accents** — messages de validation compris. Ils étaient écrits sans, par contagion de la règle sur les identifiants, et se lisaient mal : « Le numero de journee doit etre au moins 1. »

Une affirmation montrée à l'écran est une affirmation à **tester**. Le nom du fichier téléchargé l'a appris à ce dépôt : trois corrections successives, toutes trouvées par l'utilisateur et non par mes vérifications. Le bouton « Réinitialiser » promet que les affiches enregistrées ne sont pas touchées — et un test le vérifie contre une vraie base.
