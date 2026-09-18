import type { Degrade, Filtre, Noeud } from './scene';
import { COULEURS, FORMATS, type NomFormat } from './tokens';

/**
 * Decor de l'affiche.
 *
 * Il ne reste presque rien ici, et c'est le resultat d'une decision : le fond
 * etait d'abord entierement dessine — bandes dechirees, coups de pinceau
 * fuseles, centaines d'eclaboussures semees a graine, grain fractal — puis le
 * club a fourni son propre gabarit, une affiche complete. Tout ce vectoriel a
 * ete retire plutot que superpose : il ne faisait plus que brouiller l'image.
 *
 * Les sept filtres qui l'accompagnaient sont partis avec lui. Ils etaient
 * encore emis dans les definitions de CHAQUE SVG sans qu'aucun noeud ne les
 * reference.
 */
export interface Decor {
  degrades: Degrade[];
  /**
   * Filtres a declarer. Vide aujourd'hui : le gabarit apporte sa propre
   * matiere. Le champ reste, la scene et l'emetteur sachant les poser.
   */
  filtres: Filtre[];
  arriere: Noeud[];
  avant: Noeud[];
}

/** Generateur a graine : le decor doit etre identique d'un rendu a l'autre. */
export interface FondPhoto {
  source: string;
  largeur: number;
  hauteur: number;
}

/**
 * Decor de l'affiche, desormais porte par le gabarit fourni par le club.
 *
 * Le gabarit est une affiche complete : il porte le blason dans son anneau
 * rouge, le titre « CHAMPIONNAT PAR EQUIPE », « LES RENCONTRES », les deux
 * accroches manuscrites, « Nos partenaires », les raquettes, la balle, la
 * silhouette du joueur et le filet. La composition ne redessine AUCUN de ces
 * elements — les superposer les dedoublerait.
 *
 * Il ne reste donc qu'a poser la photo. Le voile sombre de la version
 * precedente a disparu avec elle : le gabarit menage deux panneaux deja noirs,
 * ou le texte blanc se detache sans aide.
 *
 * Les coups de pinceau et essaims d'eclaboussures dessines ont ete retires :
 * le gabarit apporte sa propre matiere, et les y ajouter ne faisait que
 * brouiller les deux.
 */
export function decorPhoto(format: NomFormat, fond: FondPhoto | undefined): Decor {
  const { largeur, hauteur } = FORMATS[format];
  const degrades: Degrade[] = [];
  const arriere: Noeud[] = [];

  if (fond) {
    arriere.push({
      type: 'image',
      role: 'fond',
      x: 0,
      y: 0,
      largeur,
      hauteur,
      source: fond.source,
      // « slice » recadre pour couvrir. Le gabarit est en 2:3, exactement le
      // format de l'affiche : le rognage est nul.
      preserveAspectRatio: 'xMidYMid slice',
    });
  } else {
    // Repli sans gabarit livre : un aplat nocturne, pour que l'affiche reste
    // lisible plutot que transparente.
    degrades.push({
      id: 'fond-repli',
      type: 'lineaire',
      x1: 0,
      y1: 0,
      x2: 0.3,
      y2: 1,
      etapes: [
        { position: 0, couleur: COULEURS.bleuNuit },
        { position: 1, couleur: COULEURS.nuit },
      ],
    });
    arriere.push({
      type: 'rect',
      role: 'fond',
      x: 0,
      y: 0,
      largeur,
      hauteur,
      remplissage: 'url(#fond-repli)',
    });
  }

  return { degrades, filtres: [], arriere, avant: [] };
}
