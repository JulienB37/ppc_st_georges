import * as fontkit from 'fontkit';

import type { FamillePolice } from '../render/tokens';

/**
 * Mesure de texte.
 *
 * Piece maitresse du moteur : c'est elle qui permet de positionner le texte
 * en connaissant sa largeur, au lieu d'esperer qu'il tienne. Un spike
 * (`npm run spike:rendu`) a verifie que l'avance calculee ici predit ce que
 * resvg rasterise a 0,4-0,8 % pres sur des chaines reelles, et qu'elle en est
 * toujours un majorant.
 *
 * Aucun acces au systeme de fichiers : les tampons de polices sont injectes.
 * C'est ce qui permet au meme code de tourner dans un worker, dans Node pour
 * les tests, et dans le renderer Electron.
 */

export interface FacePolice {
  famille: FamillePolice | string;
  graisse: number;
  donnees: Uint8Array;
}

export interface StyleTexte {
  famille: FamillePolice | string;
  graisse: number;
  taille: number;
  /** En fraction du corps. */
  interlettrage?: number;
}

export interface Metriques {
  /** Hauteur au-dessus de la ligne de base, en fraction du corps. */
  ascendante: number;
  /** Profondeur sous la ligne de base, positive, en fraction du corps. */
  descendante: number;
  /** Hauteur des capitales, en fraction du corps. */
  capitale: number;
}

/** Un caractere que la police livree ne sait pas dessiner. */
export interface GlypheManquant {
  caractere: string;
  pointDeCode: number;
}

export interface MoteurTexte {
  largeur(texte: string, style: StyleTexte): number;
  metriques(style: Pick<StyleTexte, 'famille' | 'graisse'>): Metriques;
  hauteurLigne(style: StyleTexte): number;
  /** Decalage de la ligne de base pour centrer verticalement dans une boite. */
  ligneDeBaseCentree(style: StyleTexte, centreY: number): number;
  /**
   * Ligne de base centrant les CAPITALES sur une ordonnee.
   *
   * Centrer sur la boite em place le centre des capitales a
   * `(ascendante - descendante - capitale) / 2` du centre voulu, un ecart qui
   * depend entierement de la face. Mesure sur les faces livrees : 5,0 % du
   * corps sur Barlow Semi Condensed, -0,6 % sur Anton, et **0,0 % sur Protest
   * Strike**, dont la boite em est symetrique.
   *
   * Autrement dit, sur la police du rang de journee cette methode rend
   * exactement la meme ligne de base que `ligneDeBaseCentree`. Elle est
   * neanmoins celle a employer sur un texte tout en capitales : l'egalite est
   * une propriete de cette face, pas de la regle, et changer de police
   * d'affichage deplacerait sinon le texte sans que rien ne le signale.
   */
  ligneDeBaseCapitales(style: StyleTexte, centreY: number): number;
  glyphesManquants(texte: string, style: Pick<StyleTexte, 'famille' | 'graisse'>): GlypheManquant[];
  ajuster(texte: string, largeurMax: number, style: StyleTexte, echelons: number[]): TexteAjuste;
  faces(): readonly FacePolice[];
}

export interface TexteAjuste {
  taille: number;
  largeur: number;
  /** Vrai si le texte deborde encore au plus petit echelon autorise. */
  deborde: boolean;
}

interface FaceChargee {
  face: FacePolice;
  police: fontkit.Font;
}

function cle(famille: string, graisse: number): string {
  return `${famille}|${graisse}`;
}

/**
 * Construit le moteur a partir des faces livrees.
 *
 * Echoue franchement si une face demandee manque, plutot que de rendre avec
 * une autre : c'est le repli silencieux qui rendait les anciennes affiches
 * fausses sans que rien ne l'indique.
 */
export function creerMoteurTexte(faces: FacePolice[]): MoteurTexte {
  if (faces.length === 0) {
    throw new Error('Aucune face de police fournie au moteur de texte.');
  }

  const chargees = new Map<string, FaceChargee>();
  for (const face of faces) {
    // fontkit type son entree comme un `Buffer` Node ; il accepte en realite
    // tout `Uint8Array`, ce qui est la seule forme disponible en worker. On ne
    // nomme pas `Buffer` ici : la librairie doit rester hors de Node.
    const entree = face.donnees as unknown as Parameters<typeof fontkit.create>[0];
    const police = fontkit.create(entree) as fontkit.Font;
    chargees.set(cle(face.famille, face.graisse), { face, police });
  }

  const parFamille = new Map<string, FaceChargee[]>();
  for (const chargee of chargees.values()) {
    const liste = parFamille.get(chargee.face.famille) ?? [];
    liste.push(chargee);
    parFamille.set(chargee.face.famille, liste);
  }

  function resoudre(famille: string, graisse: number): FaceChargee {
    const exacte = chargees.get(cle(famille, graisse));
    if (exacte) return exacte;

    const disponibles = parFamille.get(famille);
    if (!disponibles?.length) {
      throw new Error(
        `Famille « ${famille} » absente des polices livrees ` +
          `(${[...parFamille.keys()].join(', ') || 'aucune'}).`,
      );
    }
    // resvg ne synthetise pas le gras : une graisse non livree serait rendue
    // par la face la plus proche, en silence. Autant le dire tout de suite.
    const graisses = disponibles.map((d) => d.face.graisse).sort((a, b) => a - b);
    throw new Error(
      `Graisse ${graisse} absente pour « ${famille} » (livrees : ${graisses.join(', ')}). ` +
        `resvg ne synthetise pas le gras : rendre cette graisse donnerait une autre face.`,
    );
  }

  function avanceParEm(texte: string, famille: string, graisse: number): number {
    const { police } = resoudre(famille, graisse);
    if (texte.length === 0) return 0;
    return police.layout(texte).advanceWidth / police.unitsPerEm;
  }

  const moteur: MoteurTexte = {
    largeur(texte, style) {
      const base = avanceParEm(texte, style.famille, style.graisse) * style.taille;
      if (!style.interlettrage || texte.length === 0) return base;
      // `letter-spacing` ajoute un ecart apres chaque glyphe, dernier compris :
      // c'est ainsi que le rendent les moteurs SVG.
      return base + style.interlettrage * style.taille * texte.length;
    },

    metriques(style) {
      const { police } = resoudre(style.famille, style.graisse);
      return {
        ascendante: police.ascent / police.unitsPerEm,
        descendante: Math.abs(police.descent) / police.unitsPerEm,
        // Certaines polices d'affichage ne declarent pas capHeight : on
        // retombe alors sur l'ascendante, qui en est proche sur une capitale.
        capitale: (police.capHeight ?? police.ascent) / police.unitsPerEm,
      };
    },

    hauteurLigne(style) {
      const m = moteur.metriques(style);
      return (m.ascendante + m.descendante) * style.taille;
    },

    ligneDeBaseCentree(style, centreY) {
      const m = moteur.metriques(style);
      const hauteur = (m.ascendante + m.descendante) * style.taille;
      return centreY - hauteur / 2 + m.ascendante * style.taille;
    },

    ligneDeBaseCapitales(style, centreY) {
      const m = moteur.metriques(style);
      return centreY + (m.capitale * style.taille) / 2;
    },

    glyphesManquants(texte, style) {
      const { police } = resoudre(style.famille, style.graisse);
      const manquants: GlypheManquant[] = [];
      const vus = new Set<number>();
      for (const caractere of texte) {
        const pointDeCode = caractere.codePointAt(0);
        if (pointDeCode === undefined || vus.has(pointDeCode)) continue;
        vus.add(pointDeCode);
        // L'espace insecable et consorts n'ont pas toujours de glyphe propre
        // et ne se voient de toute facon pas.
        if (/\s/u.test(caractere)) continue;
        if (!police.hasGlyphForCodePoint(pointDeCode)) {
          manquants.push({ caractere, pointDeCode });
        }
      }
      return manquants;
    },

    ajuster(texte, largeurMax, style, echelons) {
      const tries = echelons.length ? echelons : [style.taille];
      for (const taille of tries) {
        const largeur = moteur.largeur(texte, { ...style, taille });
        if (largeur <= largeurMax) return { taille, largeur, deborde: false };
      }
      const derniere = tries[tries.length - 1] ?? style.taille;
      return {
        taille: derniere,
        largeur: moteur.largeur(texte, { ...style, taille: derniere }),
        deborde: true,
      };
    },

    faces: () => faces,
  };

  return moteur;
}

/** Echelons de reduction d'un nom d'equipe, du nominal au plancher. */
export function echelonsDepuis(nominal: number, plancher: number, pas = 2): number[] {
  const sortie: number[] = [];
  for (let taille = Math.round(nominal); taille >= plancher; taille -= pas) sortie.push(taille);
  if (sortie[sortie.length - 1] !== plancher) sortie.push(plancher);
  return sortie;
}
