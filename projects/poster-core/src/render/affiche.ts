import { calculerDensite, repartirEnColonnes, type Densite } from '../layout/densite';
import { echelonsDepuis, type MoteurTexte, type StyleTexte } from '../layout/mesure';
import { monogramme } from '../clubs/normaliser';
import { formatCreneau } from '../format/creneau';
import { rangJourneeParties } from '../format/ordinal';
import type { Affiche, Groupe, Rencontre } from '../model/journee';
import { decorPhoto, type FondPhoto } from './decor';
import { PINCEAU, transformPinceau } from './pinceau.generated';
import { ANNEAU, transformAnneau } from './anneau.generated';
import { VS, transformVs } from './vs.generated';
import type { Boite, Decoupe, Degrade, Filtre, Noeud, NoeudTexte, Scene } from './scene';
import {
  BANDE_JOURNEE,
  CADRAGE_LOGO,
  COULEURS,
  TEINTES_CRENEAU,
  ESPACES,
  FORMATS,
  GRAISSES,
  PANNEAUX,
  PLANCHERS,
  POLICES,
  RETRAIT_PANNEAU,
  TRAITS,
  ROTATION_GABARIT,
  RAYONS,
  accent,
  type FamillePolice,
  type NomFormat,
} from './tokens';

/**
 * Composition de l'affiche : domaine + assets -> scene positionnee.
 *
 * Registre d'affiche d'evenement : fond nocturne entierement dessine, titres
 * inclines, halos, accents manuscrits. Toutes les images arrivent deja
 * resolues en data URL — la librairie ne lit jamais un fichier, ce qui lui
 * permet de tourner a l'identique dans un worker, dans Node et dans Electron.
 */

export interface LogoResolu {
  source: string;
  largeur: number;
  hauteur: number;
}

export interface SponsorResolu extends LogoResolu {
  id: string;
}

export interface AssetsAffiche {
  /** Fond photographique livre par le club. Absent : aplat nocturne de repli. */
  fond?: FondPhoto;
  blason: LogoResolu;
  logos: ReadonlyMap<string, LogoResolu>;
  sponsors: SponsorResolu[];
}

export interface OptionsComposition {
  format?: NomFormat;
  nomClub?: string;
}

export interface Diagnostic {
  niveau: 'info' | 'alerte';
  message: string;
}

export interface Composition {
  scene: Scene;
  densite: Densite;
  diagnostics: Diagnostic[];
  zoneContenu: Boite;
}

const NOM_CLUB_DEFAUT = 'St Georges';

/**
 * Jeu entre l'anneau et la pastille, en part du disque libre de l'anneau.
 *
 * Mince a dessein : l'anneau doit se lire comme un cerne du logo, pas comme une
 * seconde rondelle posee autour.
 */
const JEU_ANNEAU = 0.05;

function styleTexte(taille: number, graisse: number, interlettrage = 0): StyleTexte {
  return { famille: POLICES.texte, graisse, taille, interlettrage };
}

function styleDisplay(taille: number): StyleTexte {
  return { famille: POLICES.display, graisse: GRAISSES.display, taille };
}

interface OptionsTexte {
  role?: string;
  ancre?: NoeudTexte['ancre'];
  opacite?: number;
  /** Contour du texte, dessine en une passe sous la passe pleine. */
  contour?: string;
  epaisseurContour?: number;
}

/** Fabrique un noeud texte en reportant la mesure, dont dependent les invariants. */
function texte(
  contenu: string,
  x: number,
  y: number,
  style: StyleTexte,
  couleur: string,
  moteur: MoteurTexte,
  options: OptionsTexte = {},
): NoeudTexte {
  return {
    type: 'texte',
    contenu,
    x,
    y,
    famille: style.famille as FamillePolice,
    graisse: style.graisse,
    taille: style.taille,
    couleur,
    interlettrage: style.interlettrage,
    largeurMesuree: moteur.largeur(contenu, style),
    hauteurMesuree: moteur.hauteurLigne(style),
    ...options,
  };
}

/**
 * Cadre un logo dans sa pastille.
 *
 * Plus grand rectangle du rapport donne inscriptible dans le disque :
 * `l = d·k/√(1+k²)`. La formule redonne le carre inscrit quand le rapport vaut
 * 1 et traite tous les autres de la meme facon, sans seuil a regler.
 */
export function cadrerLogo(logo: LogoResolu, diametre: number): Boite {
  const ratio = logo.hauteur > 0 ? logo.largeur / logo.hauteur : 1;
  const diagonale = Math.hypot(1, ratio);
  const largeur = ((diametre * ratio) / diagonale) * CADRAGE_LOGO.remplissage;
  const hauteur = (diametre / diagonale) * CADRAGE_LOGO.remplissage;
  return { x: -largeur / 2, y: -hauteur / 2, largeur, hauteur };
}

/**
 * Pastille de logo, cerclee de l'anneau au pinceau du club.
 *
 * Le parametre est le diametre EXTERIEUR disponible, et non celui du logo : le
 * trace du club occupe 23 % du rayon autour de son disque libre — mesure a la
 * generation — et un appelant qui dimensionnerait le logo verrait l'anneau
 * deborder de sa rangee.
 *
 * L'ordre de derivation est donc : place offerte, puis disque libre de
 * l'anneau, puis jeu, puis logo.
 */
function pastille(
  cx: number,
  cy: number,
  diametreExterieur: number,
  logo: LogoResolu | undefined,
  libelle: string,
  moteur: MoteurTexte,
  decoupes: Decoupe[],
  idDecoupe: string,
  couleurAnneau: string,
): Noeud[] {
  // Disque libre au centre de l'anneau, puis jeu, puis pastille.
  const diametreLibre = (diametreExterieur * ANNEAU.rayonInterieur) / ANNEAU.rayonExterieur;
  const diametre = diametreLibre * (1 - 2 * JEU_ANNEAU);
  const r = diametre / 2;

  const noeuds: Noeud[] = [
    {
      type: 'cercle',
      role: 'pastille',
      cx,
      cy,
      r,
      remplissage: COULEURS.blanc,
    },
    {
      type: 'groupe',
      role: 'anneau',
      transform: transformAnneau(cx, cy, diametreLibre),
      enfants: [
        {
          type: 'groupe',
          transform: ANNEAU.transformInterne,
          enfants: ANNEAU.chemins.map((d) => ({
            type: 'chemin' as const,
            d,
            remplissage: couleurAnneau,
          })),
        },
      ],
    },
  ];

  if (logo) {
    decoupes.push({ id: idDecoupe, cercle: { cx, cy, r: r - 1 } });
    const boite = cadrerLogo(logo, diametre);
    noeuds.push({
      type: 'image',
      role: 'logo',
      x: cx + boite.x,
      y: cy + boite.y,
      largeur: boite.largeur,
      hauteur: boite.hauteur,
      source: logo.source,
      // Decoupe circulaire obligatoire : sans elle, un logo a fond
      // rectangulaire colore affiche un rectangle dans un cercle.
      clip: idDecoupe,
    });
    return noeuds;
  }

  const mono = monogramme(libelle);
  const style = styleDisplay(diametre * CADRAGE_LOGO.facteurMonogramme);
  noeuds.push(
    texte(mono, cx, moteur.ligneDeBaseCentree(style, cy), style, COULEURS.bleuNuit, moteur, {
      role: 'monogramme',
      ancre: 'middle',
    }),
  );
  return noeuds;
}

/** Calendrier encadre, comme sur la reference, a gauche de chaque creneau. */
function iconeCalendrier(x: number, y: number, taille: number, couleur: string): Noeud {
  const k = taille / 24;
  return {
    type: 'groupe',
    role: 'icone-calendrier',
    enfants: [
      {
        type: 'rect',
        x: x + 2 * k,
        y: y + 5 * k,
        largeur: 20 * k,
        hauteur: 17 * k,
        rx: 2 * k,
        remplissage: 'none',
        contour: couleur,
        epaisseur: Math.max(1.2, 2 * k),
      },
      // Les deux anneaux de reliure.
      {
        type: 'rect',
        x: x + 7 * k,
        y: y + 2 * k,
        largeur: 2 * k,
        hauteur: 5 * k,
        remplissage: couleur,
      },
      {
        type: 'rect',
        x: x + 15 * k,
        y: y + 2 * k,
        largeur: 2 * k,
        hauteur: 5 * k,
        remplissage: couleur,
      },
      // Bandeau de l'en-tete du calendrier.
      {
        type: 'rect',
        x: x + 2 * k,
        y: y + 9 * k,
        largeur: 20 * k,
        hauteur: 2.2 * k,
        remplissage: couleur,
      },
      // Une case cochee.
      {
        type: 'rect',
        x: x + 6 * k,
        y: y + 14 * k,
        largeur: 5 * k,
        hauteur: 4.5 * k,
        remplissage: couleur,
      },
    ],
  };
}

/** Petite maison, pour un creneau a domicile. Chemin normalise sur 24 x 24. */
function iconeMaison(x: number, y: number, taille: number, couleur: string): Noeud {
  const k = taille / 24;
  const p = (a: number, b: number) => `${x + a * k} ${y + b * k}`;
  return {
    type: 'chemin',
    role: 'icone',
    d: `M ${p(12, 3)} L ${p(22, 11)} L ${p(19, 11)} L ${p(19, 21)} L ${p(14, 21)} L ${p(14, 15)} L ${p(10, 15)} L ${p(10, 21)} L ${p(5, 21)} L ${p(5, 11)} L ${p(2, 11)} Z`,
    remplissage: couleur,
  };
}

/** Goutte de localisation, pour un deplacement. */
function iconeRepere(x: number, y: number, taille: number, couleur: string): Noeud {
  const k = taille / 24;
  const p = (a: number, b: number) => `${x + a * k} ${y + b * k}`;
  return {
    type: 'chemin',
    role: 'icone',
    d:
      `M ${p(12, 2)} C ${p(7.6, 2)} ${p(4, 5.6)} ${p(4, 10)} ` +
      `C ${p(4, 15)} ${p(12, 22)} ${p(12, 22)} ` +
      `C ${p(12, 22)} ${p(20, 15)} ${p(20, 10)} ` +
      `C ${p(20, 5.6)} ${p(16.4, 2)} ${p(12, 2)} Z ` +
      `M ${p(12, 13)} C ${p(10.3, 13)} ${p(9, 11.7)} ${p(9, 10)} ` +
      `C ${p(9, 8.3)} ${p(10.3, 7)} ${p(12, 7)} ` +
      `C ${p(13.7, 7)} ${p(15, 8.3)} ${p(15, 10)} ` +
      `C ${p(15, 11.7)} ${p(13.7, 13)} ${p(12, 13)} Z`,
    remplissage: couleur,
  };
}

/**
 * Rang de la journee, pose sur la bande peinte du gabarit.
 *
 * C'est le seul element du haut que le gabarit ne porte pas, puisque c'est le
 * seul qui change chaque semaine. Il n'a plus de pastille : le gabarit lui
 * reserve une bande rouge sous « LES RENCONTRES », et en redessiner une
 * dessus faisait un rectangle rapporte sur une affiche peinte.
 */
function bandeau(
  affiche: Affiche,
  numeroJournee: number,
  moteur: MoteurTexte,
  diagnostics: Diagnostic[],
): Noeud[] {
  const { chiffre, suffixe } = rangJourneeParties(numeroJournee);
  const famille = { famille: POLICES.display, graisse: GRAISSES.display };
  const metriques = moteur.metriques(famille);

  /**
   * Ecarts, en part du corps.
   *
   * Poses par la composition et non delegues a l'espace de la police : les
   * morceaux sont des textes distincts, il n'y a aucun espace entre eux.
   */
  const ECART_MOT = 0.3;
  const ECART_EXPOSANT = 0.2;
  /** Corps de l'exposant, en part du corps courant. */
  const RAPPORT_EXPOSANT = 0.58;

  /**
   * Morceaux du libelle, poses cote a cote.
   *
   * Le decoupage a deux raisons. L'exposant, d'abord, que l'emetteur SVG ne
   * peut pas obtenir autrement, faute de `<tspan>` de style. L'espace-mot,
   * ensuite : celui de cette brosse est si serre que « Journee jeunes » se
   * lisait « Journeejeunes ». L'ecart est donc pose ici, en part du corps.
   *
   * Bas de casse pour les mots : le gabarit reserve les capitales a ses
   * propres titres, et tout en capitales le rang de journee criait plus fort
   * que « LES RENCONTRES ».
   */
  const morceaux: { texte: string; exposant?: boolean; ecartAvant?: number }[] = [
    { texte: chiffre },
    { texte: suffixe, exposant: true },
    { texte: 'Journée', ecartAvant: ECART_EXPOSANT },
    ...(affiche.categorie === 'jeunes' ? [{ texte: 'jeunes', ecartAvant: ECART_MOT }] : []),
  ];

  const corpsDe = (taille: number, m: (typeof morceaux)[number]) =>
    m.exposant ? taille * RAPPORT_EXPOSANT : taille;

  const largeurTotale = (taille: number): number =>
    morceaux.reduce(
      (t, m) =>
        t +
        (m.ecartAvant ?? 0) * taille +
        moteur.largeur(m.texte, { ...famille, taille: corpsDe(taille, m) }),
      0,
    );

  // Le corps se deduit de la bande : les capitales en occupent 62 % de la
  // hauteur, puis la largeur mesuree le reduit si la mention « jeunes »
  // l'allonge. Le rapport est volontairement bas — le trace peint doit rester
  // visible autour du texte, sinon le rang de journee lit comme une etiquette
  // collee et non comme une inscription sur l'affiche.
  //
  // `ajuster` ne peut pas servir : il mesure une chaine unique. La reduction se
  // fait donc a la main, sur les memes echelons.
  const tailleHaute = (BANDE_JOURNEE.hauteur * 0.62) / metriques.capitale;
  const disponible = BANDE_JOURNEE.largeur * 0.82;
  const echelons = echelonsDepuis(tailleHaute, tailleHaute * 0.5);
  const taille = echelons.find((t) => largeurTotale(t) <= disponible) ?? echelons.at(-1)!;
  if (largeurTotale(taille) > disponible) {
    diagnostics.push({
      niveau: 'alerte',
      message: `« ${morceaux.map((m) => m.texte).join(' ')} » est trop long pour la bande du gabarit.`,
    });
  }

  const cx = BANDE_JOURNEE.x + BANDE_JOURNEE.largeur / 2;
  const cy = BANDE_JOURNEE.y + BANDE_JOURNEE.hauteur / 2;
  // La ligne de base se cale sur la hauteur de capitale, et non sur la boite
  // em, dont les reserves dependent de la face.
  const base = moteur.ligneDeBaseCapitales({ ...famille, taille }, cy);
  const hautCapitales = base - metriques.capitale * taille;

  const enfants: Noeud[] = [];
  let x = cx - largeurTotale(taille) / 2;

  for (const m of morceaux) {
    x += (m.ecartAvant ?? 0) * taille;
    const style: StyleTexte = { ...famille, taille: corpsDe(taille, m) };
    // L'exposant s'aligne par le HAUT des capitales, pas par la ligne de base :
    // c'est ce qui le fait lire comme un exposant et non comme un petit mot.
    const y = m.exposant ? hautCapitales + metriques.capitale * style.taille : base;
    const largeur = moteur.largeur(m.texte, style);

    enfants.push(
      texte(m.texte, x, y, style, COULEURS.blanc, moteur, {
        role: m.exposant ? 'journee-exposant' : 'journee-texte',
        // Le trace peint est mouchete : le lisere sombre garantit la lisibilite
        // la ou le rouge laisse voir le fond bleu.
        contour: COULEURS.nuit,
        epaisseurContour: taille * 0.07,
      }),
    );

    x += largeur;
  }

  return [
    {
      type: 'groupe',
      role: 'journee',
      // Rotation, et non `skewX` : le cisaillement penche les futs mais laisse
      // la ligne de base horizontale, ce qui posait le texte a plat sur une
      // bande qui monte de 7,3 degres.
      transform: `rotate(${ROTATION_GABARIT} ${cx} ${cy})`,
      enfants,
    },
  ];
}

interface Contexte {
  densite: Densite;
  moteur: MoteurTexte;
  assets: AssetsAffiche;
  couleurAccent: string;
  nomClub: string;
  decoupes: Decoupe[];
  diagnostics: Diagnostic[];
}

function enteteGroupe(
  groupe: Groupe,
  x: number,
  y: number,
  ctx: Contexte,
  teinte: string,
): Noeud[] {
  const { densite, moteur } = ctx;
  // La bande occupe l'essentiel de la hauteur reservee. Un coup de pinceau
  // s'affine a ses extremites : trop basse, la bande etrangle son texte.
  const h = Math.min(62, densite.hauteurEnteteGroupe * 0.84);
  const cy = y + h / 2;

  const date = groupe.creneau.libelleOverride ?? formatCreneau(groupe.creneau.debutIso);
  const lieu = groupe.domicile ? 'À domicile' : "À l'extérieur";
  const styleDate = styleTexte(Math.max(21, h * 0.42), GRAISSES.fort);
  const styleLieu = styleTexte(Math.max(17, h * 0.34), GRAISSES.appuye);

  const tailleIcone = h * 0.5;
  const largeurDate = moteur.largeur(date, styleDate);
  const largeurLieu = moteur.largeur(lieu, styleLieu);
  const largeurPilule =
    ESPACES.s4 + tailleIcone + ESPACES.s2 + largeurDate + ESPACES.s3 + largeurLieu + ESPACES.s4;

  // Le fond de la bande est un coup de pinceau vectoriel fourni par le club,
  // etire a la longueur de la date. Il remplace le parallelogramme : une forme
  // peinte se lit comme une affiche, un quadrilatere comme un gabarit.
  //
  // Le trace est plus haut que la bande utile — un coup de brosse baveux — donc
  // on l'etire sur une hauteur superieure et on le recentre verticalement.
  const largeurBande = largeurPilule + tailleIcone + ESPACES.s2;
  // `transformPinceau` ne place que la bande PLEINE du trace : la hauteur
  // demandee est donc directement l'epaisseur obtenue. Un leger debord
  // vertical laisse respirer les bords ronges, et un debord horizontal plus
  // large loge les extremites effilees en dehors du texte.
  const debordV = h * 0.3;
  const debordH = h * 1.1;
  // Le debord gauche est borne : au-dela, la pointe effilee sort du panneau
  // noir du gabarit et bave sur la photo.
  const debordGauche = Math.min(debordH * 0.45, RETRAIT_PANNEAU - 2);
  // Le fond peint ne prend plus que deux tiers de la hauteur allouee au
  // creneau : la bande etait bien plus haute que son texte ne le demandait, et
  // ce qui restait n'etait que du remplissage colore. La hauteur allouee, elle,
  // ne change pas — c'est elle qui dimensionne le texte et les icones, et elle
  // qui est comptee par la loi de densite.
  const hauteurTracee = (h + debordV) * (2 / 3);
  const noeuds: Noeud[] = [
    {
      type: 'groupe',
      role: 'entete-groupe',
      transform: transformPinceau(
        x - debordGauche,
        cy - hauteurTracee / 2,
        largeurBande + debordH,
        hauteurTracee,
      ),
      enfants: [{ type: 'chemin', d: PINCEAU.chemin, remplissage: teinte }],
    },
  ];

  let curseur = x + ESPACES.s3;
  noeuds.push(iconeCalendrier(curseur, cy - tailleIcone / 2, tailleIcone, COULEURS.blanc));
  curseur += tailleIcone + ESPACES.s2;

  noeuds.push(
    texte(
      date,
      curseur,
      moteur.ligneDeBaseCentree(styleDate, cy),
      styleDate,
      COULEURS.blanc,
      moteur,
      { role: 'date' },
    ),
  );
  curseur += largeurDate + ESPACES.s3;

  noeuds.push(
    texte(
      lieu,
      curseur,
      moteur.ligneDeBaseCentree(styleLieu, cy),
      styleLieu,
      COULEURS.blanc,
      moteur,
      { role: 'lieu', opacite: 0.9 },
    ),
  );
  curseur += largeurLieu + ESPACES.s2;
  noeuds.push(
    groupe.domicile
      ? iconeMaison(curseur, cy - tailleIcone * 0.42, tailleIcone * 0.84, COULEURS.blanc)
      : iconeRepere(curseur, cy - tailleIcone * 0.42, tailleIcone * 0.84, COULEURS.blanc),
  );

  return noeuds;
}

/**
 * Marque « VS », l'eclaboussure vectorielle fournie par le club.
 *
 * Elle remplace le texte « VS » : a la taille ou l'affiche est reellement vue,
 * deux lettres au milieu d'une ligne passaient pour du bruit, la ou une tache
 * se lit d'un coup d'oeil.
 *
 * Les lettres sont AJOUREES dans le trace : il ne dessine que la tache. Un
 * aplat blanc est donc pose dessous pour qu'elles se lisent en blanc, et non a
 * la couleur de la carte.
 *
 * Cet aplat est une union de disques MESURES a la generation : ils couvrent la
 * totalite des lettres sans sortir de la silhouette, faute de quoi le blanc
 * deborderait de la tache. Un disque unique n'y suffisait pas — le plus grand
 * inscrit ne couvre que 96,7 % des lettres.
 *
 * La tache reprend la teinte de la bande de date de son creneau. Les rangees
 * d'un meme creneau sont ainsi reliees a leur en-tete par la couleur, ce que la
 * seule proximite verticale ne disait pas.
 */
function marqueVs(cx: number, cy: number, hauteur: number, couleur: string): Noeud {
  return {
    type: 'groupe',
    role: 'vs',
    transform: transformVs(cx, cy, hauteur),
    enfants: [
      ...VS.disques.map((d) => ({
        type: 'cercle' as const,
        role: 'vs-aplat',
        cx: d.cx,
        cy: d.cy,
        r: d.r,
        remplissage: COULEURS.blanc,
      })),
      // Les chemins vivent dans le repere de la vectorisation, les disques dans
      // celui du viewBox : d'ou ce second groupe.
      {
        type: 'groupe' as const,
        transform: VS.transformInterne,
        enfants: VS.chemins.map((d) => ({ type: 'chemin' as const, d, remplissage: couleur })),
      },
    ],
  };
}

function rangee(
  rencontre: Rencontre,
  domicile: boolean,
  x: number,
  y: number,
  largeur: number,
  indice: string,
  ctx: Contexte,
  teinteCreneau: string,
): Noeud[] {
  const { densite, moteur } = ctx;
  const h = densite.hauteurRangee;
  const cy = y + h / 2;
  const noeuds: Noeud[] = [];

  noeuds.push({
    type: 'rect',
    role: 'carte',
    x,
    y,
    largeur,
    hauteur: h,
    rx: RAYONS.carte,
    remplissage: COULEURS.carte,
    // Le liseré reprend la teinte du creneau : la carte est ainsi rattachee a
    // sa bande de date par la couleur, comme l'anneau du club et la marque
    // « VS ». Le bleu neutre `carteBord` ne rattachait la carte a rien.
    contour: teinteCreneau,
    epaisseur: TRAITS.lisereCarte,
  });

  // L'anneau deborde volontairement de la carte, dans l'ecart qui la separe de
  // la suivante : lui faire tenir dans la hauteur de carte rognerait le logo
  // d'un quart, alors que l'ecart entre rangees est vide.
  const d = Math.min(densite.pasRangee * 0.96, largeur * 0.3);
  const marge = 2;
  const cxGauche = x + marge + d / 2;
  const cxDroite = x + largeur - marge - d / 2;

  // Le blason du club reste toujours a gauche : l'oeil retrouve « nous » au
  // meme endroit sur chaque ligne, et les logos adverses heterogenes sont
  // confines a une seule colonne. Le lieu est porte par l'en-tete de groupe.
  noeuds.push(
    ...pastille(
      cxGauche,
      cy,
      d,
      ctx.assets.blason,
      ctx.nomClub,
      moteur,
      ctx.decoupes,
      `clip-l-${indice}`,
      // L'anneau du club prend la teinte du creneau, celui de l'adversaire
      // reste blanc : la couleur dit « nous », et sur une liste scannee de haut
      // en bas cela vaut mieux qu'un anneau cycle sans rapport avec rien.
      teinteCreneau,
    ),
  );

  const logoAdverse = ctx.assets.logos.get(rencontre.adversaire.clubId);
  if (!logoAdverse) {
    ctx.diagnostics.push({
      niveau: 'alerte',
      message: `Aucun logo pour « ${rencontre.adversaire.libelle} » : un monogramme sera affiché.`,
    });
  }
  noeuds.push(
    ...pastille(
      cxDroite,
      cy,
      d,
      logoAdverse,
      rencontre.adversaire.libelle,
      moteur,
      ctx.decoupes,
      `clip-r-${indice}`,
      COULEURS.blanc,
    ),
  );

  // La marque « VS » occupe l'essentiel de la hauteur de rangee : c'est elle
  // qui donne le rythme de la liste, les noms se rangeant de part et d'autre.
  const hauteurVs = h * 0.92;
  const largeurVs = hauteurVs * VS.rapport;
  const cxVs = x + largeur / 2;
  noeuds.push(marqueVs(cxVs, cy, hauteurVs, teinteCreneau));

  // Les deux camps partagent desormais graisse et couleur : le club n'est plus
  // appuye ni l'adversaire estompe. Ce qui designe « nous » sur la ligne, c'est
  // l'anneau colore du blason, pas une hierarchie typographique.
  const styleNom = styleTexte(densite.tailleNom, GRAISSES.courant);
  const echelons = echelonsDepuis(densite.tailleNom, PLANCHERS.tailleNom);

  // Champ gauche : pastille de division puis nom du club.
  let curseur = cxGauche + d / 2 + ESPACES.s2;
  if (rencontre.equipeLocale.division) {
    const stylePuce = styleTexte(densite.taillePuce, GRAISSES.fort, 0.03);
    const largeurTexte = moteur.largeur(rencontre.equipeLocale.division, stylePuce);
    const largeurPuce = largeurTexte + ESPACES.s2 * 1.4;
    noeuds.push({
      type: 'rect',
      role: 'puce-division',
      x: curseur,
      y: cy - densite.hauteurPuce / 2,
      largeur: largeurPuce,
      hauteur: densite.hauteurPuce,
      rx: RAYONS.puce,
      remplissage: ctx.couleurAccent,
    });
    noeuds.push(
      texte(
        rencontre.equipeLocale.division,
        curseur + largeurPuce / 2,
        moteur.ligneDeBaseCentree(stylePuce, cy),
        stylePuce,
        COULEURS.blanc,
        moteur,
        { role: 'division', ancre: 'middle' },
      ),
    );
    curseur += largeurPuce + ESPACES.s2;
  }

  const nomLocal = `${ctx.nomClub} ${rencontre.equipeLocale.numero}`;
  const bordGaucheVs = cxVs - largeurVs / 2 - ESPACES.s3;
  const local = moteur.ajuster(nomLocal, bordGaucheVs - curseur, styleNom, echelons);
  noeuds.push(
    texte(
      nomLocal,
      curseur,
      moteur.ligneDeBaseCentree({ ...styleNom, taille: local.taille }, cy),
      { ...styleNom, taille: local.taille },
      COULEURS.blanc,
      moteur,
      { role: 'nom-local' },
    ),
  );

  const xDroite = cxDroite - d / 2 - ESPACES.s2;
  const bordDroitVs = cxVs + largeurVs / 2 + ESPACES.s3;
  const adverse = moteur.ajuster(
    rencontre.adversaire.libelle,
    xDroite - bordDroitVs,
    styleNom,
    echelons,
  );
  if (adverse.deborde) {
    ctx.diagnostics.push({
      niveau: 'alerte',
      message: `« ${rencontre.adversaire.libelle} » est trop long pour sa ligne.`,
    });
  }
  noeuds.push(
    texte(
      rencontre.adversaire.libelle,
      xDroite,
      moteur.ligneDeBaseCentree({ ...styleNom, taille: adverse.taille }, cy),
      { ...styleNom, taille: adverse.taille },
      COULEURS.blanc,
      moteur,
      { role: 'nom-adverse', ancre: 'end' },
    ),
  );

  return noeuds;
}

/**
 * Rangee en duel : une ou deux rencontres, chacune sur une grande carte.
 *
 * La variante etait annoncee par le moteur de densite depuis le debut, mais
 * rendue comme une liste : une journee jeunes de deux rencontres laissait donc
 * les trois quarts du panneau vides. Ici les blasons se font face en grand, le
 * « VS » tient le centre, et les noms passent sous chaque camp — ce qui remplit
 * la hauteur au lieu de l'etaler.
 */
function rangeeDuel(
  rencontre: Rencontre,
  x: number,
  y: number,
  largeur: number,
  indice: string,
  ctx: Contexte,
  teinteCreneau: string,
): Noeud[] {
  const { densite, moteur } = ctx;
  const h = densite.hauteurRangee;
  const noeuds: Noeud[] = [];

  noeuds.push({
    type: 'rect',
    role: 'carte',
    x,
    y,
    largeur,
    hauteur: h,
    rx: RAYONS.carte,
    remplissage: COULEURS.carte,
    // Le liseré reprend la teinte du creneau : la carte est ainsi rattachee a
    // sa bande de date par la couleur, comme l'anneau du club et la marque
    // « VS ». Le bleu neutre `carteBord` ne rattachait la carte a rien.
    contour: teinteCreneau,
    epaisseur: TRAITS.lisereCarte,
  });

  // Les blasons occupent le tiers haut de la carte, les noms le tiers bas :
  // le diametre est donc borne par la hauteur autant que par la largeur.
  const d = Math.min(h * 0.46, largeur * 0.3);
  const cy = y + h * 0.4;
  const cxGauche = x + largeur * 0.24;
  const cxDroite = x + largeur * 0.76;

  noeuds.push(
    ...pastille(
      cxGauche,
      cy,
      d,
      ctx.assets.blason,
      ctx.nomClub,
      moteur,
      ctx.decoupes,
      `clip-dl-${indice}`,
      teinteCreneau,
    ),
  );

  const logoAdverse = ctx.assets.logos.get(rencontre.adversaire.clubId);
  if (!logoAdverse) {
    ctx.diagnostics.push({
      niveau: 'alerte',
      message: `Aucun logo pour « ${rencontre.adversaire.libelle} » : un monogramme sera affiché.`,
    });
  }
  noeuds.push(
    ...pastille(
      cxDroite,
      cy,
      d,
      logoAdverse,
      rencontre.adversaire.libelle,
      moteur,
      ctx.decoupes,
      `clip-dr-${indice}`,
      COULEURS.blanc,
    ),
  );

  // Au duel, la marque se cale sur l'espace laisse entre les deux blasons,
  // pas sur la taille des noms.
  const hauteurVs = Math.min(h * 0.4, (cxDroite - cxGauche - d) / VS.rapport);
  noeuds.push(marqueVs(x + largeur / 2, cy, hauteurVs, teinteCreneau));

  // Noms sous chaque camp, centres sur leur blason et ajustes a la moitie de
  // la carte pour qu'ils ne se rejoignent jamais au centre.
  const largeurNom = largeur * 0.44;
  const cyNom = y + h * 0.76;
  const styleNom = styleTexte(Math.min(40, h * 0.11), GRAISSES.courant);
  const echelons = echelonsDepuis(styleNom.taille, PLANCHERS.tailleNom);

  const nomLocal = `${ctx.nomClub} ${rencontre.equipeLocale.numero}`;
  const local = moteur.ajuster(nomLocal, largeurNom, styleNom, echelons);
  noeuds.push(
    texte(
      nomLocal,
      cxGauche,
      moteur.ligneDeBaseCentree({ ...styleNom, taille: local.taille }, cyNom),
      { ...styleNom, taille: local.taille },
      COULEURS.blanc,
      moteur,
      { role: 'nom-local', ancre: 'middle' },
    ),
  );

  const adverse = moteur.ajuster(rencontre.adversaire.libelle, largeurNom, styleNom, echelons);
  if (adverse.deborde) {
    ctx.diagnostics.push({
      niveau: 'alerte',
      message: `« ${rencontre.adversaire.libelle} » est trop long pour sa carte.`,
    });
  }
  noeuds.push(
    texte(
      rencontre.adversaire.libelle,
      cxDroite,
      moteur.ligneDeBaseCentree({ ...styleNom, taille: adverse.taille }, cyNom),
      { ...styleNom, taille: adverse.taille },
      COULEURS.blanc,
      moteur,
      { role: 'nom-adverse', ancre: 'middle' },
    ),
  );

  // La division reste attachee a l'equipe locale, sous son nom.
  if (rencontre.equipeLocale.division) {
    const cyPuce = y + h * 0.89;
    const stylePuce = styleTexte(densite.taillePuce, GRAISSES.fort, 0.03);
    const largeurPuce =
      moteur.largeur(rencontre.equipeLocale.division, stylePuce) + ESPACES.s2 * 1.4;
    noeuds.push({
      type: 'rect',
      role: 'puce-division',
      x: cxGauche - largeurPuce / 2,
      y: cyPuce - densite.hauteurPuce / 2,
      largeur: largeurPuce,
      hauteur: densite.hauteurPuce,
      rx: RAYONS.puce,
      remplissage: ctx.couleurAccent,
    });
    noeuds.push(
      texte(
        rencontre.equipeLocale.division,
        cxGauche,
        moteur.ligneDeBaseCentree(stylePuce, cyPuce),
        stylePuce,
        COULEURS.blanc,
        moteur,
        { role: 'division', ancre: 'middle' },
      ),
    );
  }

  return noeuds;
}

/** Une cellule blanche portant un logo partenaire. */
function celluleSponsor(
  sponsor: SponsorResolu,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
): Noeud[] {
  const retrait = Math.min(14, hauteur * 0.18);
  const utileL = largeur - 2 * retrait;
  const utileH = hauteur - 2 * retrait;
  const ratio = sponsor.hauteur > 0 ? sponsor.largeur / sponsor.hauteur : 1;

  let l = utileL;
  let h = utileL / ratio;
  if (h > utileH) {
    h = utileH;
    l = utileH * ratio;
  }

  return [
    // Carte blanche systematique : elle donne un champ neutre commun a des
    // logos dont les fonds sont tantot transparents, tantot opaques.
    {
      type: 'rect',
      role: 'cellule-sponsor',
      x,
      y,
      largeur,
      hauteur,
      rx: 10,
      remplissage: COULEURS.blanc,
    },
    {
      type: 'image',
      role: 'sponsor',
      x: x + (largeur - l) / 2,
      y: y + (hauteur - h) / 2,
      largeur: l,
      hauteur: h,
      source: sponsor.source,
    },
  ];
}

/**
 * Les partenaires, dans le panneau de droite du gabarit.
 *
 * Le gabarit y peint deja le titre « Nos partenaires » : on ne pose que les
 * cellules. Le nombre de partenaires etant fixe a cinq (deux epingles, trois
 * en rotation), la colonne se divise simplement.
 */
function panneauSponsors(assets: AssetsAffiche, boite: Boite): Noeud[] {
  const noeuds: Noeud[] = [];
  const n = Math.max(1, assets.sponsors.length);
  const ecart = 10;
  const hauteurCellule = (boite.hauteur - (n - 1) * ecart) / n;

  assets.sponsors.forEach((sponsor, i) => {
    noeuds.push(
      ...celluleSponsor(
        sponsor,
        boite.x,
        boite.y + i * (hauteurCellule + ecart),
        boite.largeur,
        hauteurCellule,
      ),
    );
  });
  return noeuds;
}

function hauteurGroupe(groupe: Groupe, densite: Densite): number {
  return (
    densite.hauteurEnteteGroupe + groupe.rencontres.length * densite.pasRangee + densite.ecartGroupe
  );
}

export function composerAffiche(
  affiche: Affiche,
  numeroJournee: number,
  assets: AssetsAffiche,
  moteur: MoteurTexte,
  options: OptionsComposition = {},
): Composition {
  const format = options.format ?? 'portrait';
  const { largeur, hauteur } = FORMATS[format];
  const couleurAccent = accent(affiche.categorie);

  // Les deux panneaux du gabarit fixent les zones : plus rien a calculer, il
  // suffit de s'y inscrire avec un retrait pour ne pas coller aux bords.
  const zoneContenu: Boite = {
    x: PANNEAUX.contenu.x + RETRAIT_PANNEAU,
    y: PANNEAUX.contenu.y + RETRAIT_PANNEAU,
    largeur: PANNEAUX.contenu.largeur - 2 * RETRAIT_PANNEAU,
    hauteur: PANNEAUX.contenu.hauteur - 2 * RETRAIT_PANNEAU,
  };

  const nbRencontres = affiche.groupes.reduce((t, g) => t + g.rencontres.length, 0);
  const densite = calculerDensite(
    nbRencontres,
    affiche.groupes.length,
    format,
    zoneContenu.hauteur,
    zoneContenu.largeur,
    affiche.groupes.map((g) => g.rencontres.length),
  );

  const decoupes: Decoupe[] = [];
  const diagnostics: Diagnostic[] = [];
  const ctx: Contexte = {
    densite,
    moteur,
    assets,
    couleurAccent,
    nomClub: options.nomClub ?? NOM_CLUB_DEFAUT,
    decoupes,
    diagnostics,
  };

  const decor = decorPhoto(format, assets.fond);
  const degrades: Degrade[] = [...decor.degrades];
  const filtres: Filtre[] = [...decor.filtres];
  const noeuds: Noeud[] = [
    // Le decor est regroupe et non disperse : voiles et fond couvrent tout le
    // cadre, et les invariants de mise en page doivent pouvoir l'ecarter sans
    // ecarter le contenu.
    { type: 'groupe', role: 'decor', enfants: decor.arriere },
    ...bandeau(affiche, numeroJournee, moteur, diagnostics),
  ];

  const colonnes =
    densite.colonnes === 2
      ? repartirEnColonnes(affiche.groupes, (g) => hauteurGroupe(g, densite))
      : [affiche.groupes, []];
  const largeurColonne =
    densite.colonnes === 2 ? (zoneContenu.largeur - ESPACES.s5) / 2 : zoneContenu.largeur;

  colonnes.forEach((groupes, iColonne) => {
    const xColonne = zoneContenu.x + iColonne * (largeurColonne + ESPACES.s5);
    // Le facteur de densite plafonne a 1,15 : une journee de deux rencontres
    // ne peut pas remplir le panneau, et un bloc colle en haut laisse un grand
    // rectangle noir vide dessous. On centre donc le reliquat.
    const hauteurBloc = groupes.reduce((t, g) => t + hauteurGroupe(g, densite), 0);
    const reliquat = Math.max(0, zoneContenu.hauteur - hauteurBloc);
    let y = zoneContenu.y + reliquat / 2;

    groupes.forEach((groupe, iGroupe) => {
      // Une teinte par creneau plutot qu'une teinte par lieu : cela rythme la
      // liste, le lieu restant porte par son icone et son libelle. Elle est
      // calculee ici, et non deduite d'un index dans chaque fonction : la bande
      // de date et la marque « VS » doivent porter exactement la meme.
      const teinteCreneau = TEINTES_CRENEAU[(iGroupe + iColonne * 2) % TEINTES_CRENEAU.length]!;
      noeuds.push(...enteteGroupe(groupe, xColonne, y, ctx, teinteCreneau));
      y += densite.hauteurEnteteGroupe;

      groupe.rencontres.forEach((rencontre, iRencontre) => {
        const indice = `${iColonne}-${iGroupe}-${iRencontre}`;
        noeuds.push(
          ...(densite.variante === 'duel'
            ? rangeeDuel(rencontre, xColonne, y, largeurColonne, indice, ctx, teinteCreneau)
            : rangee(
                rencontre,
                groupe.domicile,
                xColonne,
                y,
                largeurColonne,
                indice,
                ctx,
                teinteCreneau,
              )),
        );
        y += densite.pasRangee;
      });
      y += densite.ecartGroupe;
    });
  });

  noeuds.push(
    ...panneauSponsors(assets, {
      x: PANNEAUX.partenaires.x + RETRAIT_PANNEAU / 2,
      y: PANNEAUX.partenaires.y + RETRAIT_PANNEAU / 2,
      largeur: PANNEAUX.partenaires.largeur - RETRAIT_PANNEAU,
      hauteur: PANNEAUX.partenaires.hauteur - RETRAIT_PANNEAU,
    }),
  );

  // La signature manuscrite du pied est peinte dans le gabarit.

  if (densite.strategie === 'reduit') {
    diagnostics.push({
      niveau: 'info',
      message: `Contenu réduit à ${Math.round(densite.facteur * 100)} % pour tenir dans l'affiche.`,
    });
  }
  if (densite.strategie === 'colonnes') {
    diagnostics.push({
      niveau: 'info',
      message: `${nbRencontres} rencontres : mise en page sur deux colonnes.`,
    });
  }

  // Le grain passe par-dessus tout : c'est lui qui enleve au degrade son
  // aspect parfaitement propre.
  noeuds.push({ type: 'groupe', role: 'decor-avant', enfants: decor.avant });

  return {
    scene: { largeur, hauteur, decoupes, degrades, filtres, noeuds },
    densite,
    diagnostics,
    zoneContenu,
  };
}
