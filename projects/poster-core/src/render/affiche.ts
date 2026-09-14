import { calculerDensite, repartirEnColonnes, type Densite } from '../layout/densite';
import { echelonsDepuis, type MoteurTexte, type StyleTexte } from '../layout/mesure';
import { monogramme } from '../clubs/normaliser';
import { formatCreneau } from '../format/creneau';
import { ordinalJournee } from '../format/ordinal';
import type { Affiche, Groupe, Rencontre } from '../model/journee';
import { decorPhoto, parallelogramme, type FondPhoto } from './decor';
import type { Boite, Decoupe, Degrade, Filtre, Noeud, NoeudTexte, Scene } from './scene';
import {
  CADRAGE_LOGO,
  COULEURS,
  TEINTES_ANNEAU,
  TEINTES_CRENEAU,
  ESPACES,
  FORMATS,
  GRAISSES,
  INCLINAISON,
  MARGE_X,
  PADDING_CONTENU_Y,
  PLANCHERS,
  POLICES,
  RAYONS,
  TRAITS,
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

/** Ou poser les logos partenaires. */
export type DispositionSponsors = 'bande' | 'colonne';

export interface OptionsComposition {
  format?: NomFormat;
  nomClub?: string;
  dispositionSponsors?: DispositionSponsors;
  accrocheBasse?: string;
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
const ACCROCHE_BASSE = 'Ensemble\npour la passion du Ping !';

/**
 * Zones, calees sur les reperes mesures dans le fond livre (en repere
 * 1080 x 1350) :
 *   - titre incruste        : x 321-838, y 27-262
 *   - raquettes et balle    : x 558-1072, y 134-424
 *   - anneau rouge du blason: centre 155,195
 *   - silhouette du joueur  : x 775-1036, y 1112-1340
 * Le contenu s'inscrit donc entre les raquettes et la silhouette.
 */
const HAUT_CONTENU = 398;
const BAS_CONTENU = 1158;
const LARGEUR_COLONNE_SPONSORS = 206;
const ECART_COLONNE = 26;
const HAUTEUR_BANDE_SPONSORS = 160;

/** Decalage horizontal induit par `skewX` a une ordonnee donnee. */
const PENTE = Math.tan((-INCLINAISON * Math.PI) / 180);
function compenser(y: number): number {
  return y * PENTE;
}

function styleTexte(taille: number, graisse: number, interlettrage = 0): StyleTexte {
  return { famille: POLICES.texte, graisse, taille, interlettrage };
}

function styleDisplay(taille: number): StyleTexte {
  return { famille: POLICES.display, graisse: GRAISSES.display, taille };
}

function styleManuscrit(taille: number): StyleTexte {
  return { famille: POLICES.manuscrit, graisse: GRAISSES.manuscrit, taille };
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

function pastille(
  cx: number,
  cy: number,
  diametre: number,
  logo: LogoResolu | undefined,
  libelle: string,
  moteur: MoteurTexte,
  decoupes: Decoupe[],
  idDecoupe: string,
  couleurAnneau: string,
): Noeud[] {
  const r = diametre / 2;
  const noeuds: Noeud[] = [
    {
      type: 'cercle',
      role: 'pastille',
      cx,
      cy,
      r,
      remplissage: COULEURS.blanc,
      contour: couleurAnneau,
      epaisseur: TRAITS.contourPastille * 1.8,
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

function bandeau(
  affiche: Affiche,
  numeroJournee: number,
  assets: AssetsAffiche,
  moteur: MoteurTexte,
  options: OptionsComposition,
): Noeud[] {
  const couleurAccent = accent(affiche.categorie);
  const noeuds: Noeud[] = [];

  // Le titre « CHAMPIONNAT PAR EQUIPE » et l'accroche manuscrite du haut sont
  // INCRUSTES dans le fond livre : les redessiner les dedoublerait. Le bandeau
  // ne pose donc que ce que le fond n'a pas.

  // Blason, dans l'anneau rouge que le fond lui reserve. Detoure par dilatation
  // de sa silhouette alpha : un liseré fin suffit ici, l'anneau faisant deja
  // le cadre.
  const dBlason = 208;
  const cadre = cadrerLogo(assets.blason, dBlason);
  noeuds.push({
    type: 'image',
    role: 'blason',
    x: 155 + cadre.x,
    y: 196 + cadre.y,
    largeur: cadre.largeur,
    hauteur: cadre.hauteur,
    source: assets.blason.source,
    filtre: 'contour-fin',
  });

  // Banniere « LES RENCONTRES » et pastille de journee, sous le titre incruste.
  const yBanniere = 300;
  const hBanniere = 62;
  const cyBanniere = yBanniere + hBanniere / 2;
  const libelleRencontres =
    affiche.categorie === 'jeunes' ? 'LES RENCONTRES JEUNES' : 'LES RENCONTRES';
  const styleBanniere = styleDisplay(42);
  const largeurBanniere = moteur.largeur(libelleRencontres, styleBanniere) + ESPACES.s6;

  const libelleJournee = `${ordinalJournee(numeroJournee).toUpperCase()} JOURNÉE`;
  const styleJournee = styleDisplay(28);
  const largeurJournee = moteur.largeur(libelleJournee, styleJournee) + ESPACES.s5;
  const xBanniere = 258;
  const xJournee = xBanniere + largeurBanniere + ESPACES.s3;

  noeuds.push({
    type: 'groupe',
    role: 'banniere',
    transform: `skewX(${INCLINAISON})`,
    enfants: [
      {
        type: 'chemin',
        role: 'banniere-fond',
        // Coins VIFS et cisaillement, comme les surlignages du fond livre.
        d: parallelogramme(
          xBanniere + compenser(yBanniere),
          yBanniere,
          largeurBanniere,
          hBanniere,
          14,
        ),
        remplissage: COULEURS.blanc,
      },
      texte(
        libelleRencontres,
        xBanniere + ESPACES.s4 + compenser(cyBanniere),
        moteur.ligneDeBaseCentree(styleBanniere, cyBanniere),
        styleBanniere,
        COULEURS.nuit,
        moteur,
        { role: 'banniere-texte' },
      ),
      {
        type: 'chemin',
        role: 'pastille-journee',
        d: parallelogramme(
          xJournee + compenser(yBanniere + 8),
          yBanniere + 8,
          largeurJournee,
          hBanniere - 16,
          11,
        ),
        remplissage: couleurAccent,
      },
      texte(
        libelleJournee,
        xJournee + largeurJournee / 2 + compenser(cyBanniere),
        moteur.ligneDeBaseCentree(styleJournee, cyBanniere),
        styleJournee,
        COULEURS.blanc,
        moteur,
        { role: 'journee-texte', ancre: 'middle' },
      ),
    ],
  });

  void options;
  return noeuds;
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
  indexGroupe: number,
): Noeud[] {
  const { densite, moteur } = ctx;
  const h = Math.min(46, densite.hauteurEnteteGroupe * 0.74);
  const cy = y + h / 2;
  // Une teinte par creneau plutot qu'une teinte par lieu : cela rythme la
  // liste, le lieu restant porte par son icone et son libelle.
  const teinte = TEINTES_CRENEAU[indexGroupe % TEINTES_CRENEAU.length]!;

  const date = groupe.creneau.libelleOverride ?? formatCreneau(groupe.creneau.debutIso);
  const lieu = groupe.domicile ? 'À domicile' : "À l'extérieur";
  const styleDate = styleTexte(Math.max(19, h * 0.46), GRAISSES.fort);
  const styleLieu = styleTexte(Math.max(16, h * 0.38), GRAISSES.appuye);

  const tailleIcone = h * 0.5;
  const largeurDate = moteur.largeur(date, styleDate);
  const largeurLieu = moteur.largeur(lieu, styleLieu);
  const largeurPilule =
    ESPACES.s4 + tailleIcone + ESPACES.s2 + largeurDate + ESPACES.s3 + largeurLieu + ESPACES.s4;

  const noeuds: Noeud[] = [
    {
      type: 'chemin',
      role: 'entete-groupe',
      // Coins vifs et cisaillement, comme les surlignages de titre.
      d: parallelogramme(x, y, largeurPilule + tailleIcone + ESPACES.s2, h, h * 0.22),
      remplissage: teinte,
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

function rangee(
  rencontre: Rencontre,
  domicile: boolean,
  x: number,
  y: number,
  largeur: number,
  indice: string,
  ctx: Contexte,
  indexRangee: number,
): Noeud[] {
  const teinteAnneau = TEINTES_ANNEAU[indexRangee % TEINTES_ANNEAU.length]!;
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
    contour: COULEURS.carteBord,
    epaisseur: 1.5,
  });

  const d = densite.diametreLogo;
  const marge = 8;
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
      teinteAnneau,
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
      teinteAnneau,
    ),
  );

  // Le « VS » revient, mais comme une marque inclinee a l'accent de l'affiche,
  // et non comme du texte de sept points perdu au milieu de la ligne.
  // « VS » nettement plus grand que les noms, contoure de sombre : c'est une
  // marque graphique, pas du texte courant.
  const styleVs = styleDisplay(Math.max(26, densite.tailleNom * 1.15));
  const largeurVs = moteur.largeur('VS', styleVs);
  const cxVs = x + largeur / 2;
  noeuds.push({
    type: 'groupe',
    role: 'vs',
    transform: `skewX(${INCLINAISON})`,
    enfants: [
      texte(
        'VS',
        cxVs + compenser(cy),
        moteur.ligneDeBaseCentree(styleVs, cy),
        styleVs,
        COULEURS.blanc,
        moteur,
        {
          ancre: 'middle',
          role: 'vs-texte',
          contour: COULEURS.nuit,
          epaisseurContour: styleVs.taille * 0.16,
        },
      ),
    ],
  });

  const styleNom = styleTexte(densite.tailleNom, GRAISSES.fort);
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
  const styleAdverse = styleTexte(densite.tailleNom, GRAISSES.courant);
  const adverse = moteur.ajuster(
    rencontre.adversaire.libelle,
    xDroite - bordDroitVs,
    styleAdverse,
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
      moteur.ligneDeBaseCentree({ ...styleAdverse, taille: adverse.taille }, cy),
      { ...styleAdverse, taille: adverse.taille },
      COULEURS.brume,
      moteur,
      { role: 'nom-adverse', ancre: 'end' },
    ),
  );

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

function sponsorsEnBande(assets: AssetsAffiche, y: number, moteur: MoteurTexte): Noeud[] {
  const style = styleManuscrit(36);
  const noeuds: Noeud[] = [
    texte('Ils font vivre le club', MARGE_X, y + 34, style, COULEURS.blanc, moteur, {
      role: 'titre-sponsors',
      opacite: 0.92,
    }),
  ];

  const n = Math.max(1, assets.sponsors.length);
  const largeurUtile = FORMATS.portrait.largeur - 2 * MARGE_X;
  const ecart = 14;
  const largeurCellule = (largeurUtile - (n - 1) * ecart) / n;

  assets.sponsors.forEach((sponsor, i) => {
    noeuds.push(
      ...celluleSponsor(
        sponsor,
        MARGE_X + i * (largeurCellule + ecart),
        y + 50,
        largeurCellule,
        HAUTEUR_BANDE_SPONSORS - 62,
      ),
    );
  });
  return noeuds;
}

function sponsorsEnColonne(
  assets: AssetsAffiche,
  x: number,
  y: number,
  hauteur: number,
  moteur: MoteurTexte,
): Noeud[] {
  const style = styleManuscrit(36);
  const noeuds: Noeud[] = [
    texte(
      'Nos partenaires',
      x + LARGEUR_COLONNE_SPONSORS / 2,
      y + 30,
      style,
      COULEURS.blanc,
      moteur,
      {
        role: 'titre-sponsors',
        ancre: 'middle',
      },
    ),
  ];

  const n = Math.max(1, assets.sponsors.length);
  const hautCellules = y + 48;
  const ecart = 12;
  const hauteurCellule = (hauteur - 48 - (n - 1) * ecart) / n;

  assets.sponsors.forEach((sponsor, i) => {
    noeuds.push(
      ...celluleSponsor(
        sponsor,
        x,
        hautCellules + i * (hauteurCellule + ecart),
        LARGEUR_COLONNE_SPONSORS,
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
  const enBande = (options.dispositionSponsors ?? 'bande') === 'bande';
  const { largeur, hauteur } = FORMATS[format];
  const couleurAccent = accent(affiche.categorie);

  // La bande basse mangerait la silhouette du joueur : en disposition « bande »
  // le contenu remonte d'autant.
  const basContenu = BAS_CONTENU - (enBande ? HAUTEUR_BANDE_SPONSORS : 0);
  const zoneContenu: Boite = {
    x: MARGE_X,
    y: HAUT_CONTENU,
    largeur: largeur - 2 * MARGE_X - (enBande ? 0 : LARGEUR_COLONNE_SPONSORS + ECART_COLONNE),
    hauteur: basContenu - HAUT_CONTENU - PADDING_CONTENU_Y,
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

  const decor = decorPhoto(format, assets.fond, HAUT_CONTENU, basContenu);
  const degrades: Degrade[] = [...decor.degrades];
  const filtres: Filtre[] = [...decor.filtres];
  const noeuds: Noeud[] = [
    // Le decor est regroupe et non disperse : voiles et fond couvrent tout le
    // cadre, et les invariants de mise en page doivent pouvoir l'ecarter sans
    // ecarter le contenu.
    { type: 'groupe', role: 'decor', enfants: decor.arriere },
    ...bandeau(affiche, numeroJournee, assets, moteur, options),
  ];

  const colonnes =
    densite.colonnes === 2
      ? repartirEnColonnes(affiche.groupes, (g) => hauteurGroupe(g, densite))
      : [affiche.groupes, []];
  const largeurColonne =
    densite.colonnes === 2 ? (zoneContenu.largeur - ESPACES.s5) / 2 : zoneContenu.largeur;

  let compteurRangee = 0;
  colonnes.forEach((groupes, iColonne) => {
    const xColonne = zoneContenu.x + iColonne * (largeurColonne + ESPACES.s5);
    let y = zoneContenu.y;

    groupes.forEach((groupe, iGroupe) => {
      noeuds.push(...enteteGroupe(groupe, xColonne, y, ctx, iGroupe + iColonne * 2));
      y += densite.hauteurEnteteGroupe;

      groupe.rencontres.forEach((rencontre, iRencontre) => {
        noeuds.push(
          ...rangee(
            rencontre,
            groupe.domicile,
            xColonne,
            y,
            largeurColonne,
            `${iColonne}-${iGroupe}-${iRencontre}`,
            ctx,
            compteurRangee++,
          ),
        );
        y += densite.pasRangee;
      });
      y += densite.ecartGroupe;
    });
  });

  noeuds.push(
    ...(enBande
      ? sponsorsEnBande(assets, basContenu + PADDING_CONTENU_Y, moteur)
      : sponsorsEnColonne(
          assets,
          largeur - MARGE_X - LARGEUR_COLONNE_SPONSORS,
          zoneContenu.y + 40,
          // La silhouette du joueur commence a y = 1112 dans le fond livre :
          // la colonne s'arrete avant, sinon elle la masque.
          1090 - zoneContenu.y - 40,
          moteur,
        )),
  );

  // Signature en bas a GAUCHE : la silhouette du joueur occupe tout le coin
  // bas-droit du fond livre, une signature centree la chevaucherait.
  const styleSignature = styleManuscrit(44);
  const lignesSignature = (options.accrocheBasse ?? ACCROCHE_BASSE).split('\n');
  noeuds.push({
    type: 'groupe',
    role: 'accroche-basse',
    transform: `rotate(-4 ${MARGE_X} ${hauteur - 96})`,
    enfants: lignesSignature.map((ligne, i) =>
      texte(ligne, MARGE_X + 6, hauteur - 104 + i * 46, styleSignature, COULEURS.blanc, moteur, {
        opacite: 0.95,
      }),
    ),
  });

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
