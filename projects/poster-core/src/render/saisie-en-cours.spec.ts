import { describe, expect, it } from 'vitest';

import { creerMoteurTexte } from '../layout/mesure';
import { chargerPolicesLivrees } from '../layout/polices.fixture';
import type { Affiche, Groupe } from '../model/journee';
import { creerAffiche, nouvelId } from '../model/journee';
import { composerAffiche, type AssetsAffiche, type LogoResolu } from './affiche';
import { emettreSvg } from './emettre';
import { parcourir } from './scene';

/**
 * L'affiche se compose PENDANT la saisie, pas seulement quand elle est finie.
 *
 * L'apercu se redessine a chaque frappe : la composition voit donc tous les
 * etats intermediaires d'un document qu'on remplit. Deux d'entre eux la
 * faisaient echouer, et l'utilisateur lisait un message de moteur de rendu
 * alors qu'il n'avait rien saisi de faux :
 *
 *   - un creneau SANS RENCONTRE — l'etat d'un document neuf — donnait un pas de
 *     rangee infini, donc des coordonnees non finies ;
 *   - une date ou une heure INCOMPLETE faisait lever le formatage de creneau.
 *
 * Ces tests tiennent le contrat qui manquait : composer un document incomplet
 * ne leve pas et ne produit aucune coordonnee non finie. Ce qui manque est dit
 * par la validation du schema, que l'interface montre a cote du champ.
 */
const moteur = creerMoteurTexte(chargerPolicesLivrees());

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgDTD2qgAAAAASUVORK5CYII=';
const logo = (): LogoResolu => ({ source: PIXEL, largeur: 256, hauteur: 198 });
const ASSETS: AssetsAffiche = {
  blason: logo(),
  logos: new Map(),
  sponsors: [1, 2, 3].map((i) => ({ id: `s${i}`, source: PIXEL, largeur: 480, hauteur: 200 })),
  fond: { source: PIXEL, largeur: 1080, hauteur: 1620 },
};

function affiche(groupes: Groupe[], categorie: 'adultes' | 'jeunes' = 'adultes'): Affiche {
  return creerAffiche(categorie, 1, '2026-09-17T10:00:00.000Z', groupes);
}

function creneau(debutIso: string, nbRencontres: number, libelle = 'Club Adverse'): Groupe {
  return {
    id: nouvelId(),
    creneau: { debutIso },
    domicile: true,
    rencontres: Array.from({ length: nbRencontres }, (_, i) => ({
      id: nouvelId(),
      equipeLocale: { division: 'R2', numero: i + 1 },
      adversaire: { clubId: '', numero: null, libelle },
    })),
  };
}

/** Coordonnees non finies de la scene, avec leur role : le diagnostic manquant. */
function coordonneesNonFinies(a: Affiche): string[] {
  const { scene } = composerAffiche(a, ASSETS, moteur);
  const mauvaises: string[] = [];
  for (const noeud of parcourir(scene.noeuds)) {
    for (const [cle, valeur] of Object.entries(noeud as unknown as Record<string, unknown>)) {
      if (typeof valeur === 'number' && !Number.isFinite(valeur)) {
        mauvaises.push(`${noeud.type}.${cle} = ${valeur} (role ${noeud.role ?? '-'})`);
      }
    }
  }
  return mauvaises;
}

const ETATS: [string, Affiche][] = [
  ['document neuf : un creneau, aucune rencontre', affiche([creneau('2026-09-19T18:00', 0)])],
  [
    'creneau vide ajoute a la suite',
    affiche([creneau('2026-09-19T18:00', 2), creneau('2026-09-20T09:30', 0)]),
  ],
  ['aucun creneau', affiche([])],
  ['date absente', affiche([creneau('T18:00', 1)])],
  ['heure absente', affiche([creneau('2026-09-19T', 1)])],
  ['rien de saisi du tout', affiche([creneau('T', 0)])],
  ['adversaire pas encore nomme', affiche([creneau('2026-09-19T18:00', 1, '')])],
  ['jeunes, creneau vide', affiche([creneau('2026-09-19T18:00', 0)], 'jeunes')],
];

describe.each(ETATS)('composition pendant la saisie — %s', (_nom, a) => {
  it('ne produit aucune coordonnee non finie', () => {
    expect(coordonneesNonFinies(a)).toEqual([]);
  });

  it('se laisse emettre en SVG', () => {
    const { scene } = composerAffiche(a, ASSETS, moteur);
    expect(() => emettreSvg(scene)).not.toThrow();
  });
});
