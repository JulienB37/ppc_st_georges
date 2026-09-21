# Affiches de championnat — PP St Georges/Cher

Prépare l'affiche des rencontres de championnat par équipes du club, publiée chaque semaine sur
Facebook.

**➜ [julienb37.github.io/ppc_st_georges](https://julienb37.github.io/ppc_st_georges/)**

L'application s'utilise dans un navigateur, s'installe sur un téléphone ou un ordinateur, et
fonctionne **sans connexion** — la saisie se fait en salle, où le wifi est incertain. Aucun compte,
aucun serveur : les affiches restent sur l'appareil qui les a créées.

Si vous cherchez à vous en servir plutôt qu'à la modifier, allez au **[guide](docs/guide.md)**.

## Ce que fait le moteur

```
Domaine  ──►  Layout  ──►  Émission SVG  ──►  resvg-wasm  ──►  pixels / PNG
(zod)        (positions)   (chaîne)          (worker)         (aperçu + export)
```

Le même rasteriseur sert l'aperçu et l'export : **l'aperçu n'est pas une approximation, ce sont les
octets du fichier à plus petite échelle**. C'est la décision centrale, et elle supprime par
construction l'écart entre ce qu'on voit et ce qu'on publie.

Les affiches sont composées dans le gabarit fourni par le club. La géométrie n'est pas réglée à
l'œil : l'inclinaison de la bande peinte, les rayons de l'anneau au pinceau et la couverture de la
marque « VS » sont **mesurés** par des générateurs qui échouent bruyamment si l'asset source change
— voir `tools/build-*.mts`.

## Prérequis

Un devbox Docker fournit Node 22 et l'outillage. Toutes les commandes node passent par lui.

```bash
mmadb start
mmadb exec "npm install"
mmadb exec "npm run start"     # http://localhost:4200
```

Deux limites de `mmadb exec` à connaître : il découpe la commande sur les espaces, et **il avale le
code de sortie**. Pour tout ce qui doit échouer bruyamment, passer par `docker exec` — voir
[CLAUDE.md](CLAUDE.md).

## Commandes

| Commande                | Effet                                                 |
| ----------------------- | ----------------------------------------------------- |
| `npm run start`         | Serveur de développement                              |
| `npm run build`         | Build de production                                   |
| `npm run test:ci`       | Tests, tous projets (vitest)                          |
| `npm run lint`          | ESLint                                                |
| `npm run typecheck`     | Vérification des types                                |
| `npm run assets:verify` | Vérifie que les registres d'assets sont à jour        |
| `npm run render`        | Rend une affiche en ligne de commande, sans interface |

Les générateurs d'assets (`assets:fonts`, `assets:build`, `assets:icones`, `assets:vs`,
`assets:anneau`, `assets:pinceau`) **commitent leur sortie** : ni la CI ni le build de déploiement
n'ont besoin de binaires natifs.

## Structure

| Chemin                  | Rôle                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `projects/poster-core/` | Moteur d'affiches : modèle (zod), mise en page, émission SVG, rastérisation. **TypeScript pur** — sans Angular ni accès fichier |
| `projects/app/`         | Application Angular 22 : standalone, zoneless, signals, Signal Forms                                                            |
| `tools/`                | Générateurs d'assets et de registres typés, tous rejouables                                                                     |
| `docs/`                 | Guide d'utilisation et ses captures                                                                                             |
| `images/logo_club/`     | Logos des clubs adverses, source du registre                                                                                    |
| `images/logo_sponsors/` | Logos des partenaires, source du registre                                                                                       |
| `legacy/`               | Ancien script Bun, **gelé** — sera supprimé                                                                                     |

Deux invariants de `poster-core` sont tenus par ESLint : **aucun import Angular**, et **aucun accès
au système de fichiers**. Les assets y arrivent déjà résolus en data URL. C'est précisément ce qui
cassait l'ancien script une fois empaqueté.

## Tests

Les tests portent sur ce qui casse en silence : formatage des dates françaises, résolution des
clubs, migrations, **invariants de mise en page** (aucune boîte hors du cadre, aucun chevauchement
entre rangées), et trois **images de référence** comparées à la fois en SVG normalisé et en
condensé de pixels. Les deux sont nécessaires : si une police était remplacée, le SVG resterait
identique au caractère près et seuls les pixels changeraient.

```bash
docker exec -u julien -w /home/julien/app mmadb_ping_svg_championat bash -lc "npm run test:ci"
BENIR_GOLDENS=1 npm run test:ci   # après un changement de rendu volontaire
```

## Déploiement

Un push sur `master` publie le site via `deploy-web.yml`. Le site est servi **sous un sous-chemin**
(`/ppc_st_georges/`), ce qui a deux conséquences dont il faut se souvenir avant de toucher aux
assets ou au routage : elles sont documentées dans [CLAUDE.md](CLAUDE.md).

## Hors périmètre

Deux choses annoncées pendant la conception ont été **retirées** par décision du club, et ne
reviendront pas sans demande explicite :

- le **texte de publication Facebook** : l'outil produit l'affiche, et rien d'autre ;
- l'**application desktop Electron** : les postes passent par l'application web installée.

## L'ancien script

Toujours exécutable, à partir de `legacy/journee_config.json` :

```bash
mmadb exec "npm run render:legacy"
```

Les rendus sortent dans `legacy/resultats/`. Trois défauts connus y subsistent volontairement —
ils servaient de point de comparaison pendant la refonte et sont documentés dans
[CLAUDE.md](CLAUDE.md).
