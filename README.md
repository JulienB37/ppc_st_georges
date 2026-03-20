# Générateur d'affiches de journées de championnat

Génère automatiquement une affiche SVG et PNG pour les journées de championnat de ping-pong du club PP St Georges/Cher, à partir d'un fichier de configuration JSON.

## Stack

- **Runtime** : [Bun](https://bun.sh)
- **Rendu SVG** : `@svgdotjs/svg.js` + `svgdom`
- **Export PNG** : `@resvg/resvg-js`
- **Validation config** : `zod`

## Structure du projet

```
.
├── index.ts                  # Point d'entrée
├── journee_config.json       # Configuration de la journée à générer
├── template.svg              # Template SVG de base
├── class/
│   ├── config.class.ts       # Parsing et validation de la config (zod)
│   └── draw.class.ts         # Logique de dessin SVG
├── images/
│   ├── logo_club/            # Logos des clubs (png, jpg, jpeg)
│   └── logo_sponsors/        # Logos des sponsors (png, jpg, jpeg)
└── resultats/
    ├── svg/                  # SVG générés
    └── png/                  # PNG générés
```

## Installation

```bash
bun install
```

## Utilisation

1. Éditez `journee_config.json` avec les données de la journée
2. Lancez la génération :

```bash
bun run index.ts
```

Les fichiers sont générés dans `resultats/svg/` et `resultats/png/` avec le nom `{numéro}_journee.svg/.png`.

## Format de configuration

```json
{
  "journee": 10,
  "groupes": [
    {
      "domicile": false,
      "date": "Samedi 21 Mars à 18h00",
      "matches": [
        {
          "equipe_st_georges": "D1 (3)",
          "equipe_adverse": "Aze TT 4"
        }
      ]
    }
  ]
}
```

| Champ | Type | Description |
|---|---|---|
| `journee` | `number` | Numéro de la journée |
| `groupes` | `array` | Liste des groupes de matchs |
| `groupes[].domicile` | `boolean` | `true` = à domicile, `false` = à l'extérieur |
| `groupes[].date` | `string` | Date et heure du groupe (ex: `"Samedi 21 Mars à 18h00"`) |
| `groupes[].matches` | `array` | Liste des matchs du groupe |
| `matches[].equipe_st_georges` | `string` | Nom de l'équipe de St Georges (ex: `"R2 (1)"`) |
| `matches[].equipe_adverse` | `string` | Nom de l'équipe adverse |

## Logos des clubs

Les logos sont recherchés dans `images/logo_club/` en normalisant le nom de l'équipe :
- Suppression des accents et de la ponctuation
- Mise en minuscules
- Espaces remplacés par `_`
- Le numéro d'équipe en fin de nom est ignoré

Exemple : `"Aze TT 4"` → `aze_tt.png`

Si aucun logo n'est trouvé, `default.png` est utilisé.

Formats supportés : `.png`, `.jpg`, `.jpeg`

## Sponsors

3 sponsors sont tirés aléatoirement parmi les images de `images/logo_sponsors/` et affichés sur l'affiche.

Formats supportés : `.png`, `.jpg`, `.jpeg` (les `.svg` sont exclus)
