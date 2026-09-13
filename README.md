# Affiches de championnat — PP St Georges/Cher

Génère l'affiche des rencontres de championnat par équipe du club, publiée chaque semaine sur Facebook, ainsi que le texte de la publication.

> **Refonte en cours.** L'outil devient une application utilisable sans connaissance technique (web + desktop). L'ancien script en ligne de commande reste disponible dans [`legacy/`](legacy/) le temps de la transition.

## Prérequis

Un devbox Docker fournit Node 22 et l'outillage. Toutes les commandes node passent par lui.

```bash
mmadb start
```

## Développement

```bash
mmadb exec "npm install"
mmadb exec "npm run start"     # http://localhost:4200
```

| Commande | Effet |
| --- | --- |
| `npm run start` | Serveur de développement |
| `npm run build` | Build de production de l'application web |
| `npm run test` | Tests (vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Vérification des types |
| `npm run format` | Prettier |

## Structure

| Chemin | Rôle |
| --- | --- |
| `projects/poster-core/` | Moteur d'affiches : modèle, mise en page, émission SVG, texte de publication. TypeScript pur, sans dépendance Angular ni accès fichier. |
| `projects/app/` | Application Angular |
| `images/logo_club/` | Logos des clubs adverses |
| `images/logo_sponsors/` | Logos des sponsors |
| `legacy/` | Ancien script Bun, gelé — sert de référence de comparaison visuelle |

## L'ancien script

Toujours exécutable, à partir de `legacy/journee_config.json` :

```bash
mmadb exec "npm run render:legacy"
```

Les rendus sortent dans `legacy/resultats/`. Trois défauts connus y subsistent volontairement — ils servent de point de comparaison et sont documentés dans [CLAUDE.md](CLAUDE.md).
