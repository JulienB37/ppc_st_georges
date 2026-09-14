import { calculerDensite, repartirEnColonnes, type Densite } from '../layout/densite';
import { echelonsDepuis, type MoteurTexte, type StyleTexte } from '../layout/mesure';
import { monogramme } from '../clubs/normaliser';
import { formatCreneau } from '../format/creneau';
import { ordinalJournee } from '../format/ordinal';
import type { Affiche, Groupe, Rencontre } from '../model/journee';
import { decorNocturne } from './decor';
import type { Boite, Decoupe, Degrade, Filtre, Noeud, NoeudTexte, Scene } from './scene';
import {
  CADRAGE_LOGO,
  COULEURS,
  ESPACES,
  FORMATS,
  GRAISSES,
  HAUTEUR_BANDEAU,
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
  blason: LogoResolu;
  logos: ReadonlyMap<string, LogoResolu>;
  sponsors: SponsorResolu[];
}

/** Ou poser les logos partenaires. */
export type DispositionSponsors = 'bande' | 'colonne';

export interface OptionsComposition {
  format?: NomFormat;
  nomClub?: string;
  /** Titre principal, une ligne par saut de ligne. */
  titre?: string;
  dispositionSponsors?: DispositionSponsors;
  accrocheHaute?: string;
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
const TITRE_DEFAUT = 'CHAMPIONNAT\nPAR ÉQUIPE';
const ACCROCHE_HAUTE = 'Du jeu, du partage\net de la passion !';
const ACCROCHE_BASSE = 'Ensemble pour la passion du Ping !';

/** Hauteur reservee a la signature manuscrite, en pied d'affiche. */
const HAUTEUR_SIGNATURE = 84;
const HAUTEUR_BANDE_SPONSORS = 168;
const LARGEUR_COLONNE_SPONSORS = 208;
const ECART_COLONNE = 28;

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
      epaisseur: TRAITS.contourPastille,
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
  decoupes: Decoupe[],
  options: OptionsComposition,
): Noeud[] {
  const couleurAccent = accent(affiche.categorie);
  const largeurAffiche = FORMATS.portrait.largeur;
  const noeuds: Noeud[] = [];

  // Blason. Anneau rouge meme sur l'affiche jeunes : l'identite du club ne se
  // decline pas, seul l'accent de l'affiche change.
  const dBlason = 150;
  const cxBlason = MARGE_X + dBlason / 2;
  const cyBlason = 104;
  noeuds.push({
    type: 'cercle',
    role: 'blason-fond',
    cx: cxBlason,
    cy: cyBlason,
    r: dBlason / 2,
    remplissage: COULEURS.blanc,
    contour: COULEURS.rougePpc,
    epaisseur: TRAITS.anneauBlason,
  });
  decoupes.push({ id: 'clip-blason', cercle: { cx: cxBlason, cy: cyBlason, r: dBlason / 2 - 5 } });
  const cadre = cadrerLogo(assets.blason, dBlason - 16);
  noeuds.push({
    type: 'image',
    role: 'blason',
    x: cxBlason + cadre.x,
    y: cyBlason + cadre.y,
    largeur: cadre.largeur,
    hauteur: cadre.hauteur,
    source: assets.blason.source,
    clip: 'clip-blason',
  });

  // Accroche manuscrite, en haut a droite.
  const lignesAccroche = (options.accrocheHaute ?? ACCROCHE_HAUTE).split('\n');
  const styleAccroche = styleManuscrit(38);
  noeuds.push({
    type: 'groupe',
    role: 'accroche-haute',
    transform: `rotate(-6 ${largeurAffiche - MARGE_X - 22} 56)`,
    enfants: lignesAccroche.map((ligne, i) =>
      texte(
        ligne,
        largeurAffiche - MARGE_X - 22,
        48 + i * 38,
        styleAccroche,
        COULEURS.blanc,
        moteur,
        {
          ancre: 'end',
          opacite: 0.95,
        },
      ),
    ),
  });

  // Bloc titre incline. `skewX` sur le groupe : Anton n'a pas d'italique, et
  // resvg ne synthetise pas l'oblique — `font-style: italic` ne ferait rien.
  const xTitre = cxBlason + dBlason / 2 + ESPACES.s4;
  const largeurTitre = 440;
  const lignes = (options.titre ?? TITRE_DEFAUT).toUpperCase().split('\n');
  const styleTitre = styleDisplay(72);
  const tailleTitre = Math.min(
    ...lignes.map(
      (l) => moteur.ajuster(l, largeurTitre, styleTitre, echelonsDepuis(72, 34)).taille,
    ),
  );

  noeuds.push({
    type: 'groupe',
    role: 'titre',
    transform: `skewX(${INCLINAISON})`,
    enfants: lignes.map((ligne, i) => {
      const style = { ...styleTitre, taille: tailleTitre };
      const y = 74 + i * (tailleTitre + 4);
      return texte(ligne, xTitre + compenser(y), y, style, COULEURS.blanc, moteur, {
        role: 'titre-ligne',
      });
    }),
  });

  // Banniere « LES RENCONTRES » et pastille de journee, sur une meme ligne.
  const yBanniere = 236;
  const hBanniere = 64;
  const cyBanniere = yBanniere + hBanniere / 2;
  const libelleRencontres =
    affiche.categorie === 'jeunes' ? 'LES RENCONTRES JEUNES' : 'LES RENCONTRES';
  const styleBanniere = styleDisplay(44);
  const largeurBanniere = moteur.largeur(libelleRencontres, styleBanniere) + ESPACES.s6;

  const libelleJournee = `${ordinalJournee(numeroJournee).toUpperCase()} JOURNÉE`;
  const styleJournee = styleDisplay(30);
  const largeurJournee = moteur.largeur(libelleJournee, styleJournee) + ESPACES.s5;
  const xJournee = MARGE_X + largeurBanniere + ESPACES.s3;

  noeuds.push({
    type: 'groupe',
    role: 'banniere',
    transform: `skewX(${INCLINAISON})`,
    enfants: [
      {
        type: 'rect',
        role: 'banniere-fond',
        x: MARGE_X + compenser(yBanniere),
        y: yBanniere,
        largeur: largeurBanniere,
        hauteur: hBanniere,
        rx: 4,
        remplissage: COULEURS.nuit,
        opacite: 0.8,
      },
      texte(
        libelleRencontres,
        MARGE_X + ESPACES.s4 + compenser(cyBanniere),
        moteur.ligneDeBaseCentree(styleBanniere, cyBanniere),
        styleBanniere,
        COULEURS.blanc,
        moteur,
        { role: 'banniere-texte' },
      ),
      {
        type: 'rect',
        role: 'pastille-journee',
        x: xJournee + compenser(yBanniere),
        y: yBanniere + 7,
        largeur: largeurJournee,
        hauteur: hBanniere - 14,
        rx: (hBanniere - 14) / 2,
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

function enteteGroupe(groupe: Groupe, x: number, y: number, ctx: Contexte): Noeud[] {
  const { densite, moteur } = ctx;
  const h = Math.min(46, densite.hauteurEnteteGroupe * 0.74);
  const cy = y + h / 2;

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
      type: 'rect',
      role: 'entete-groupe',
      x,
      y,
      largeur: largeurPilule,
      hauteur: h,
      rx: h / 2,
      remplissage: groupe.domicile ? ctx.couleurAccent : COULEURS.bleuNuit,
      contour: groupe.domicile ? undefined : COULEURS.carteBord,
      epaisseur: groupe.domicile ? undefined : 1.5,
    },
  ];

  let curseur = x + ESPACES.s4;
  noeuds.push(
    groupe.domicile
      ? iconeMaison(curseur, cy - tailleIcone / 2, tailleIcone, COULEURS.blanc)
      : iconeRepere(curseur, cy - tailleIcone / 2, tailleIcone, COULEURS.blanc),
  );
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
      { role: 'lieu', opacite: 0.82 },
    ),
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
      domicile ? ctx.couleurAccent : COULEURS.carteBord,
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
      COULEURS.carteBord,
    ),
  );

  // Le « VS » revient, mais comme une marque inclinee a l'accent de l'affiche,
  // et non comme du texte de sept points perdu au milieu de la ligne.
  const styleVs = styleDisplay(Math.max(18, densite.tailleNom * 0.78));
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
        ctx.couleurAccent,
        moteur,
        { ancre: 'middle', role: 'vs-texte' },
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

  const basContenu = hauteur - HAUTEUR_SIGNATURE - (enBande ? HAUTEUR_BANDE_SPONSORS : 0);
  const zoneContenu: Boite = {
    x: MARGE_X,
    y: HAUTEUR_BANDEAU + PADDING_CONTENU_Y,
    largeur: largeur - 2 * MARGE_X - (enBande ? 0 : LARGEUR_COLONNE_SPONSORS + ECART_COLONNE),
    hauteur: basContenu - HAUTEUR_BANDEAU - 2 * PADDING_CONTENU_Y,
  };

  const nbRencontres = affiche.groupes.reduce((t, g) => t + g.rencontres.length, 0);
  const densite = calculerDensite(
    nbRencontres,
    affiche.groupes.length,
    format,
    zoneContenu.hauteur,
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

  const decor = decorNocturne(format, couleurAccent, HAUTEUR_BANDEAU);
  const degrades: Degrade[] = [...decor.degrades];
  const filtres: Filtre[] = [...decor.filtres];
  const noeuds: Noeud[] = [
    // Le decor est regroupe et non disperse : il deborde volontairement du
    // cadre — halos, coups de pinceau, raquette — et les invariants de mise en
    // page doivent pouvoir l'ecarter sans ecarter le contenu.
    { type: 'groupe', role: 'decor', enfants: decor.arriere },
    ...bandeau(affiche, numeroJournee, assets, moteur, decoupes, options),
  ];

  const colonnes =
    densite.colonnes === 2
      ? repartirEnColonnes(affiche.groupes, (g) => hauteurGroupe(g, densite))
      : [affiche.groupes, []];
  const largeurColonne =
    densite.colonnes === 2 ? (zoneContenu.largeur - ESPACES.s5) / 2 : zoneContenu.largeur;

  colonnes.forEach((groupes, iColonne) => {
    const xColonne = zoneContenu.x + iColonne * (largeurColonne + ESPACES.s5);
    let y = zoneContenu.y;

    groupes.forEach((groupe, iGroupe) => {
      noeuds.push(...enteteGroupe(groupe, xColonne, y, ctx));
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
          ),
        );
        y += densite.pasRangee;
      });
      y += densite.ecartGroupe;
    });
  });

  noeuds.push(
    ...(enBande
      ? sponsorsEnBande(assets, basContenu, moteur)
      : sponsorsEnColonne(
          assets,
          largeur - MARGE_X - LARGEUR_COLONNE_SPONSORS,
          zoneContenu.y,
          zoneContenu.hauteur,
          moteur,
        )),
  );

  const styleSignature = styleManuscrit(46);
  noeuds.push({
    type: 'groupe',
    role: 'accroche-basse',
    transform: `rotate(-3 ${largeur / 2} ${hauteur - 34})`,
    enfants: [
      texte(
        options.accrocheBasse ?? ACCROCHE_BASSE,
        largeur / 2,
        hauteur - 30,
        styleSignature,
        COULEURS.blanc,
        moteur,
        { ancre: 'middle', opacite: 0.92 },
      ),
    ],
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
