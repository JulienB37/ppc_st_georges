import { describe, expect, it } from 'vitest';

import { creerMoteurTexte } from '../layout/mesure';
import { chargerPolicesLivrees } from '../layout/polices.fixture';
import { CONFIG_V1_REELLE } from '../migrate/v1.fixture';
import { migrerDepuisV1 } from '../migrate/v1';
import type { Affiche, Groupe, Rencontre } from '../model/journee';
import { creerAffiche, nouvelId } from '../model/journee';
import { cadrerLogo, composerAffiche, type AssetsAffiche, type LogoResolu } from './affiche';
import { emettreSvg } from './emettre';
import {
  boiteDe,
  contient,
  parcourir,
  parcourirPlanaire,
  seChevauchent,
  type Boite,
} from './scene';
import { FORMATS } from './tokens';

const moteur = creerMoteurTexte(chargerPolicesLivrees());

/** Pixel transparent : les tests de mise en page ne dependent pas du contenu des images. */
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgDTD2qgAAAAASUVORK5CYII=';

function logo(largeur = 256, hauteur = 198): LogoResolu {
  return { source: PIXEL, largeur, hauteur };
}

function assets(clubIds: string[]): AssetsAffiche {
  return {
    blason: logo(),
    logos: new Map(clubIds.map((id) => [id, logo()])),
    sponsors: [1, 2, 3].map((i) => ({ id: `s${i}`, source: PIXEL, largeur: 480, hauteur: 200 })),
  };
}

function rencontre(division: string, numero: number, adverse: string): Rencontre {
  return {
    id: nouvelId(),
    equipeLocale: { division, numero },
    adversaire: { clubId: 'club-test', numero: 1, libelle: adverse },
  };
}

function groupe(domicile: boolean, nb: number, debutIso = '2026-09-19T18:00'): Groupe {
  return {
    id: nouvelId(),
    creneau: { debutIso },
    domicile,
    rencontres: Array.from({ length: nb }, (_, i) =>
      rencontre('D1', i + 1, `Club Adverse ${i + 1}`),
    ),
  };
}

function afficheDe(groupes: Groupe[]): Affiche {
  return { ...creerAffiche('adultes', 1), groupes };
}

describe('cadrerLogo', () => {
  it('redonne le carre inscrit pour un logo carre', () => {
    const boite = cadrerLogo(logo(256, 256), 100);
    expect(boite.largeur).toBeCloseTo(boite.hauteur, 6);
    // 0,707 x d, plus la surcote assumee.
    expect(boite.largeur / 100).toBeCloseTo(0.707 * 1.06, 2);
  });

  it('conserve le rapport du logo, quel qu il soit', () => {
    for (const [l, h] of [
      [256, 198],
      [256, 91],
      [199, 253],
    ]) {
      const boite = cadrerLogo(logo(l, h), 120);
      expect(boite.largeur / boite.hauteur).toBeCloseTo(l! / h!, 5);
    }
  });

  it('inscrit la boite dans le disque, a la surcote pres', () => {
    // C'est la propriete qui garantit qu'un logo large ne se fait pas rogner
    // davantage qu'un logo carre.
    for (const [l, h] of [
      [256, 256],
      [350, 124],
      [199, 253],
    ]) {
      const boite = cadrerLogo(logo(l, h), 100);
      expect(Math.hypot(boite.largeur, boite.hauteur)).toBeCloseTo(100 * 1.06, 4);
    }
  });

  it('centre la boite sur le centre de la pastille', () => {
    const boite = cadrerLogo(logo(256, 91), 80);
    expect(boite.x).toBeCloseTo(-boite.largeur / 2, 6);
    expect(boite.y).toBeCloseTo(-boite.hauteur / 2, 6);
  });
});

describe('composerAffiche — invariants de mise en page', () => {
  const cas: [string, Affiche][] = [
    ['1 rencontre', afficheDe([groupe(true, 1)])],
    ['journee type du club', afficheDe([groupe(false, 1), groupe(true, 5), groupe(true, 2)])],
    ['10 rencontres', afficheDe([groupe(true, 5), groupe(false, 5)])],
    ['16 rencontres, 4 creneaux', afficheDe([0, 1, 2, 3].map((i) => groupe(i % 2 === 0, 4)))],
  ];

  for (const [nom, affiche] of cas) {
    describe(nom, () => {
      const { scene, zoneContenu } = composerAffiche(affiche, 12, assets(['club-test']), moteur);
      // Deux exclusions, chacune pour une raison distincte : le decor deborde
      // du cadre par construction, et les sous-arbres inclines expriment leurs
      // coordonnees dans un autre repere.
      const noeuds = [...parcourirPlanaire(scene.noeuds.filter((n) => n.role !== 'decor'))];
      const cadre: Boite = { x: 0, y: 0, largeur: scene.largeur, hauteur: scene.hauteur };

      it('ne place rien hors du cadre', () => {
        // L'ancien moteur posait le second pictogramme jeunes a x=328 dans un
        // cadre large de 287, sans que rien ne le signale.
        for (const noeud of noeuds) {
          const boite = boiteDe(noeud);
          if (!boite) continue;
          expect(contient(cadre, boite, 1), `${noeud.type} / ${noeud.role}`).toBe(true);
        }
      });

      it('garde les rangees dans la zone de contenu', () => {
        for (const noeud of noeuds.filter((n) => n.role === 'carte')) {
          expect(contient(zoneContenu, boiteDe(noeud)!, 1)).toBe(true);
        }
      });

      it('ne fait jamais se chevaucher deux rangees', () => {
        // Sur les anciennes affiches, les gelules mordaient sur la rangee
        // voisine parce que rien ne verifiait leurs boites.
        const cartes = noeuds.filter((n) => n.role === 'carte').map((n) => boiteDe(n)!);
        for (let i = 0; i < cartes.length; i++) {
          for (let j = i + 1; j < cartes.length; j++) {
            expect(seChevauchent(cartes[i]!, cartes[j]!, 0.5), `cartes ${i} et ${j}`).toBe(false);
          }
        }
      });

      it('couvre entierement le cadre avec le decor', () => {
        // Contrepartie de l'exclusion ci-dessus : le fond doit bien couvrir
        // toute l'affiche, sans laisser de bord non peint.
        const fond = [...parcourir(scene.noeuds)].find((n) => n.role === 'fond');
        expect(boiteDe(fond!)).toEqual({
          x: 0,
          y: 0,
          largeur: scene.largeur,
          hauteur: scene.hauteur,
        });
      });

      it('contient chaque texte dans sa carte', () => {
        const cartes = noeuds.filter((n) => n.role === 'carte').map((n) => boiteDe(n)!);
        const textes = noeuds.filter(
          (n) => n.role === 'nom-local' || n.role === 'nom-adverse' || n.role === 'division',
        );
        for (const texte of textes) {
          const boite = boiteDe(texte)!;
          const dansUneCarte = cartes.some(
            (c) => boite.x >= c.x - 1 && boite.x + boite.largeur <= c.x + c.largeur + 1,
          );
          expect(dansUneCarte, `${texte.role} : ${JSON.stringify(boite)}`).toBe(true);
        }
      });
    });
  }
});

describe('composerAffiche — sortie', () => {
  const affiche = afficheDe([groupe(false, 1), groupe(true, 5), groupe(true, 2)]);
  const { scene, diagnostics } = composerAffiche(affiche, 12, assets(['club-test']), moteur);
  const svg = emettreSvg(scene);

  it('emet un SVG aux dimensions du format', () => {
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain(`viewBox="0 0 ${FORMATS.portrait.largeur} ${FORMATS.portrait.hauteur}"`);
  });

  it("n'emet aucune reference externe", () => {
    // Test anti-regression le plus rentable du projet : c'est exactement ce
    // qui cassait l'ancien script une fois lance depuis un autre repertoire.
    const references = [...svg.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1]!);
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference.startsWith('data:'), reference.slice(0, 40)).toBe(true);
    }
  });

  it('signale la reduction de densite a l utilisateur', () => {
    expect(diagnostics.some((d) => d.message.includes('réduit'))).toBe(true);
  });

  it('signale un logo manquant plutot que de le remplacer en silence', () => {
    const sansLogo = composerAffiche(affiche, 12, assets([]), moteur);
    expect(sansLogo.diagnostics.some((d) => d.niveau === 'alerte')).toBe(true);
    // Et il pose un monogramme, pas un pictogramme generique.
    expect([...parcourir(sansLogo.scene.noeuds)].some((n) => n.role === 'monogramme')).toBe(true);
  });
});

describe('composerAffiche — sur les donnees reelles du club', () => {
  const { journee } = migrerDepuisV1(CONFIG_V1_REELLE, { anneeSaison: 2026 });

  it('compose les deux affiches sans rien perdre ni rien deborder', () => {
    for (const affiche of journee.affiches) {
      const ids = affiche.groupes.flatMap((g) => g.rencontres.map((r) => r.adversaire.clubId));
      const { scene } = composerAffiche(affiche, journee.numero, assets(ids), moteur);

      const nbRencontres = affiche.groupes.reduce((t, g) => t + g.rencontres.length, 0);
      const cartes = [...parcourir(scene.noeuds)].filter((n) => n.role === 'carte');
      expect(cartes).toHaveLength(nbRencontres);

      const cadre: Boite = { x: 0, y: 0, largeur: scene.largeur, hauteur: scene.hauteur };
      for (const noeud of parcourirPlanaire(scene.noeuds.filter((n) => n.role !== 'decor'))) {
        const boite = boiteDe(noeud);
        if (boite) expect(contient(cadre, boite, 1), `${noeud.role}`).toBe(true);
      }
    }
  });

  it('imprime le libelle de date d origine des journees importees', () => {
    const { scene } = composerAffiche(journee.affiches[0]!, 1, assets([]), moteur);
    const dates = [...parcourir(scene.noeuds)]
      .filter((n) => n.role === 'date')
      .map((n) => (n.type === 'texte' ? n.contenu : ''));
    expect(dates).toContain('Samedi 19 Septembre à 18h00');
  });
});
