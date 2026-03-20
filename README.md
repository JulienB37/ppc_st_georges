# Générateur de SVG pour Journées de Championnat

Ce projet permet de générer automatiquement des SVG pour les journées de championnat de ping-pong à partir d'un template.

## Structure

- `championat_par_equipe_j7.html` : Fichier template SVG de référence
- `generate_journee.py` : Script Python pour générer de nouveaux SVG
- `journee_config.json` : Fichier de configuration avec les données d'une journée

## Utilisation

### 1. Préparer les données

Éditez le fichier `journee_config.json` avec les informations de la journée :

```json
{
  "journee": 8,
  "matches": [
    {
      "equipe_domicile": "4S Tours TT 8",
      "equipe_exterieur": "Équipe adverse",
      "division": "R2 (1)",
      "date": "Dimanche 18 Janvier",
      "heure": "9h30",
      "lieu": "à domicile"
    }
  ]
}
```

### 2. Générer le SVG

```bash
python3 generate_journee.py
```

Ou avec un fichier de configuration spécifique :

```bash
python3 generate_journee.py --config journee_8.json
```

## Configuration des matchs

Chaque match doit contenir :
- `equipe_domicile` : Nom de l'équipe à domicile
- `equipe_exterieur` : Nom de l'équipe à l'extérieur
- `division` : Division (ex: "R2 (1)")
- `date` : Date du match (ex: "Dimanche 18 Janvier")
- `heure` : Heure du match (ex: "9h30")
- `lieu` : "à domicile" ou "à l'extérieur"

## Personnalisation

Pour adapter le template à vos besoins :

1. Modifiez le fichier `championat_par_equipe_j7.html` dans Inkscape
2. Identifiez les éléments texte à remplacer
3. Ajoutez des marqueurs dans le script `generate_journee.py`

## Notes

- Le nombre de matchs est fixe dans le template
- La répartition domicile/extérieur peut varier
- Le dimanche peut changer selon les journées
