import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { creerMoteurTexte } from '../layout/mesure';
import { chargerPolicesLivrees } from '../layout/polices.fixture';
import { creerMoteurRendu, type MoteurRendu } from '../rasterize/moteur';
import type { Affiche, Groupe, Rencontre } from '../model/journee';
import { creerAffiche, nouvelId } from '../model/journee';
import { composerAffiche, type AssetsAffiche, type LogoResolu } from './affiche';
import { emettreSvg } from './emettre';
import { comparerCondenses, condenser, normaliserSvg, referenceOuBenir } from './golden.fixture';

/**
 * Images de reference — la quatrieme garde contre le repli silencieux de
 * police, et le filet de securite de la mise en page.
 *
 * Les images des assets sont des pixels transparents, volontairement : la
 * reference doit porter sur ce que NOUS ecrivons — geometrie, typographie,
 * couleurs — et non sur le contenu de la photographie du club, qui la ferait
 * peser des centaines de kilo-octets sans rien verifier de plus.
 *
 * Largeur d'apercu et non d'export : c'est la taille ou l'affiche est
 * reellement jugee, et le rendu y est dix fois plus rapide.
 */
const LARGEUR_APERCU = 540;
const WASM = path.resolve(process.cwd(), 'node_modules/@resvg/resvg-wasm/index_bg.wasm');

const moteurTexte = creerMoteurTexte(chargerPolicesLivrees());
let moteurRendu: MoteurRendu;

beforeAll(async () => {
  moteurRendu = await creerMoteurRendu({
    wasm: readFileSync(WASM),
    tampons: chargerPolicesLivrees().map((f) => f.donnees),
  });
});

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgDTD2qgAAAAASUVORK5CYII=';

function assets(): AssetsAffiche {
  const logo: LogoResolu = { source: PIXEL, largeur: 256, hauteur: 198 };
  return {
    blason: logo,
    logos: new Map([['club-test', logo]]),
    sponsors: [1, 2, 3, 4, 5].map((i) => ({
      id: `s${i}`,
      source: PIXEL,
      largeur: 480,
      hauteur: 200,
    })),
  };
}

function rencontre(division: string, numero: number, adverse: string): Rencontre {
  return {
    id: nouvelId(),
    equipeLocale: { division, numero },
    adversaire: { clubId: 'club-test', numero: 1, libelle: adverse },
  };
}

function groupe(domicile: boolean, nb: number, debutIso: string): Groupe {
  return {
    id: nouvelId(),
    creneau: { debutIso },
    domicile,
    rencontres: Array.from({ length: nb }, (_, i) =>
      rencontre(
        ['PR', 'D1', 'D2', 'D3', 'R2'][i % 5]!,
        i + 1,
        `ASJ La Chaussée St Victor ${i + 1}`,
      ),
    ),
  };
}

/**
 * Trois configurations figees, une par variante de mise en page.
 *
 * Les identifiants du domaine etant tires aleatoirement, l'affiche est
 * construite ici et non chargee : seules comptent les formes, et les
 * identifiants ne paraissent pas dans le SVG.
 */
const CAS: { nom: string; affiche: Affiche; rang: number }[] = [
  {
    nom: 'duel',
    rang: 1,
    affiche: { ...creerAffiche('jeunes', 1), groupes: [groupe(true, 2, '2026-09-19T18:00')] },
  },
  {
    nom: 'liste',
    rang: 12,
    affiche: {
      ...creerAffiche('adultes', 1),
      groupes: [
        groupe(false, 1, '2026-09-19T18:00'),
        groupe(true, 5, '2026-09-19T18:00'),
        groupe(true, 2, '2026-09-20T09:30'),
      ],
    },
  },
  {
    /**
     * Journee la plus chargee observable, 16 rencontres sur 4 creneaux.
     *
     * Elle ne passe PAS en double colonne, et c'est mesure : le panneau du
     * gabarit offre 741 px de large, la ou deux colonnes lisibles en
     * reclament 940 (2 x `LARGEUR_MIN_COLONNE`). La variante double colonne
     * est donc inatteignable avec ce gabarit, et une journee chargee se tasse
     * en liste unique jusqu'au plancher d'echelle, 0,62.
     */
    nom: 'liste-saturee',
    rang: 22,
    affiche: {
      ...creerAffiche('adultes', 1),
      groupes: [0, 1, 2, 3].map((i) =>
        groupe(i % 2 === 0, 4, i < 2 ? '2026-09-19T18:00' : '2026-09-20T09:30'),
      ),
    },
  },
];

describe.each(CAS)('image de reference — $nom', ({ nom, affiche, rang }) => {
  it('rend le meme SVG', () => {
    const { scene } = composerAffiche(affiche, rang, assets(), moteurTexte);
    const obtenu = normaliserSvg(emettreSvg(scene));
    expect(obtenu).toBe(referenceOuBenir(`${nom}.svg`, obtenu));
  });

  it('rend les memes pixels', () => {
    const { scene } = composerAffiche(affiche, rang, assets(), moteurTexte);
    const image = moteurRendu.pixels(emettreSvg(scene), LARGEUR_APERCU);
    const obtenu = condenser(image);
    const attendu = referenceOuBenir(`${nom}.pixels`, obtenu);

    const ecart = comparerCondenses(attendu, obtenu);
    // Le message porte les chiffres : une reference qui echoue doit dire
    // l'ampleur de la derive, pas seulement qu'il y en a une.
    expect(
      ecart.cellules,
      `${ecart.cellules}/${ecart.total} cellules hors tolerance, ecart max ${ecart.ecartMax}/255`,
    ).toBe(0);
  });
});
