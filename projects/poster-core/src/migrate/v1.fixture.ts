/**
 * Copie conforme de `legacy/journee_config.json`.
 *
 * Recopiee ici plutot que lue depuis le disque : poster-core n'accede jamais
 * au systeme de fichiers, et cette contrainte est tenue par ESLint. Le fichier
 * d'origine reste la reference ; toute divergence doit etre reportee ici.
 *
 * Ce document porte deux irregularites bien reelles, qui en font justement un
 * bon cas de test : les deux sections annoncent des numeros de journee
 * differents (1 et 8), et « Vineuil Suevres » ne dispose d'aucun logo livre.
 */
export const CONFIG_V1_REELLE = {
  adulte: {
    journee: 1,
    groupes: [
      {
        domicile: false,
        date: 'Samedi 19 Septembre à 18h00',
        matches: [{ equipe_st_georges: 'D2 (6)', equipe_adverse: 'St Sulpice TT 1' }],
      },
      {
        domicile: true,
        date: 'Samedi 19 Septembre à 18h00',
        matches: [
          { equipe_st_georges: 'PR (3)', equipe_adverse: 'ASJ La Chaussée St Victor 1' },
          { equipe_st_georges: 'PR (4)', equipe_adverse: 'Pong Vendomois 5' },
          { equipe_st_georges: 'D1 (5)', equipe_adverse: 'US Chouzy TT 2' },
          { equipe_st_georges: 'D3 (7)', equipe_adverse: 'Blois Ping 41 6' },
          { equipe_st_georges: 'D3 (8)', equipe_adverse: 'Blois Ping 41 8' },
        ],
      },
      {
        domicile: true,
        date: 'Dimanche 20 Septembre à 9h30',
        matches: [
          { equipe_st_georges: 'R2 (1)', equipe_adverse: 'Gien AS TT 1' },
          { equipe_st_georges: 'R3 (2)', equipe_adverse: 'Villefranche/Cher TT 2' },
        ],
      },
    ],
  },
  enfant: {
    journee: 8,
    date: 'Samedi 11 Avril à 10h00',
    matche_1: {
      domicile: true,
      equipe_st_georges: 'PPC St Georges 1',
      equipe_adverse: 'Vineuil Suevres TT 1',
    },
    matche_2: {
      domicile: true,
      equipe_st_georges: 'PPC St Georges 2',
      equipe_adverse: 'Vineuil Suevres TT 3',
    },
  },
} as const;
