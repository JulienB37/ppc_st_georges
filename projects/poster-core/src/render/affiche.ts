import { calculerDensite, repartirEnColonnes, type Densite } from '../layout/densite';
import { echelonsDepuis, type MoteurTexte, type StyleTexte } from '../layout/mesure';
import { monogramme } from '../clubs/normaliser';
import { formatCreneau } from '../format/creneau';
import { ordinalJournee } from '../format/ordinal';
import type { Affiche, Groupe, Rencontre } from '../model/journee';
import type { Boite, Decoupe, Noeud, Scene } from './scene';
import {
  CADRAGE_LOGO,
  COULEURS,
  ESPACES,
  FORMATS,
  GRAISSES,
  HAUTEUR_BANDEAU,
  HAUTEUR_SPONSORS,
  INTERLETTRAGE,
  LARGEUR_UTILE,
  MARGE_X,
  OPACITES,
  PADDING_CONTENU_Y,
  PLANCHERS,
  POLICES,
  RAYONS,
  SPONSORS_MEP,
  TRAITS,
  accent,
  type NomFormat,
} from './tokens';

/**
 * Composition de l'affiche : domaine + assets -> scene positionnee.
 *
 * Toutes les images arrivent deja resolues en data URL. La librairie ne lit
 * jamais un fichier, ce qui lui permet de tourner a l'identique dans un
 * worker, dans Node et dans Electron.
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
  /** Blason du club, affiche dans le bandeau et sur chaque rangee. */
  blason: LogoResolu;
  /** Logos adverses, par identifiant de club. Absent : monogramme. */
  logos: ReadonlyMap<string, LogoResolu>;
  /** Sponsors deja tires et ordonnes, au plus trois. */
  sponsors: SponsorResolu[];
}

export interface OptionsComposition {
  format?: NomFormat;
  /** Nom imprime pour les equipes du club. */
  nomClub?: string;
  /** Titre de rappel, en petites capitales au-dessus du titre principal. */
  surtitre?: string;
}

export interface Diagnostic {
  niveau: 'info' | 'alerte';
  message: string;
}

export interface Composition {
  scene: Scene;
  densite: Densite;
  diagnostics: Diagnostic[];
  /** Rectangle reserve au contenu, utilise par les tests d'invariants. */
  zoneContenu: Boite;
}

const NOM_CLUB_DEFAUT = 'PPC St Georges';

function styleTexte(taille: number, graisse: number, interlettrage = 0): StyleTexte {
  return { famille: POLICES.texte, graisse, taille, interlettrage };
}

function styleDisplay(taille: number): StyleTexte {
  return { famille: POLICES.display, graisse: GRAISSES.display, taille };
}

/**
 * Cadre un logo dans sa pastille.
 *
 * Les 33 logos livres vont du rapport 0,79 a 2,82. Plutot que des bandes de
 * rapport arbitraires, on calcule le **plus grand rectangle de ce rapport
 * inscriptible dans le disque** : pour un rapport k et un diametre d,
 * `l = d·k/√(1+k²)` et `h = d/√(1+k²)`. La formule redonne le carre inscrit
 * (0,707·d) quand k vaut 1, et traite tous les autres rapports de la meme
 * facon, sans seuil a regler.
 *
 * Une legere surcote reconnait que les angles d'un logo sont presque toujours
 * vides.
 */
export function cadrerLogo(logo: LogoResolu, diametre: number): Boite {
  const ratio = logo.hauteur > 0 ? logo.largeur / logo.hauteur : 1;
  const diagonale = Math.hypot(1, ratio);
  const largeur = ((diametre * ratio) / diagonale) * CADRAGE_LOGO.remplissage;
  const hauteur = (diametre / diagonale) * CADRAGE_LOGO.remplissage;
  return { x: -largeur / 2, y: -hauteur / 2, largeur, hauteur };
}

/** Pastille + logo, ou pastille + monogramme quand aucun logo n'est livre. */
function pastille(
  cx: number,
  cy: number,
  diametre: number,
  logo: LogoResolu | undefined,
  libelle: string,
  moteur: MoteurTexte,
  decoupes: Decoupe[],
  idDecoupe: string,
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
      contour: COULEURS.grisLigne,
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

  const texte = monogramme(libelle);
  const style = styleDisplay(diametre * CADRAGE_LOGO.facteurMonogramme);
  noeuds.push({
    type: 'texte',
    role: 'monogramme',
    x: cx,
    y: moteur.ligneDeBaseCentree(style, cy),
    contenu: texte,
    famille: POLICES.display,
    graisse: GRAISSES.display,
    taille: style.taille,
    couleur: COULEURS.bleuTable,
    ancre: 'middle',
    largeurMesuree: moteur.largeur(texte, style),
    hauteurMesuree: moteur.hauteurLigne(style),
  });
  return noeuds;
}

function fond(format: NomFormat, couleurAccent: string): Noeud[] {
  const { largeur, hauteur } = FORMATS[format];
  const yContenu = HAUTEUR_BANDEAU;
  const ySponsors = hauteur - HAUTEUR_SPONSORS;

  return [
    {
      type: 'rect',
      role: 'fond-bandeau',
      x: 0,
      y: 0,
      largeur,
      hauteur: yContenu,
      remplissage: COULEURS.bleuProfond,
    },
    {
      type: 'rect',
      role: 'fond-contenu',
      x: 0,
      y: yContenu,
      largeur,
      hauteur: ySponsors - yContenu,
      remplissage: COULEURS.bleuTable,
    },
    {
      type: 'rect',
      role: 'fond-sponsors',
      x: 0,
      y: ySponsors,
      largeur,
      hauteur: HAUTEUR_SPONSORS,
      remplissage: COULEURS.ivoire,
    },
    // Trajectoire de balle : unique decoration du bandeau.
    {
      type: 'chemin',
      role: 'motif',
      d: `M -40 ${yContenu - 26} Q ${largeur / 2} -60 ${largeur + 40} 60`,
      contour: COULEURS.blanc,
      epaisseur: TRAITS.motif,
      opacite: OPACITES.motif,
    },
    {
      type: 'rect',
      role: 'regle-haute',
      x: 0,
      y: yContenu - TRAITS.regle,
      largeur,
      hauteur: TRAITS.regle,
      remplissage: couleurAccent,
    },
    {
      type: 'rect',
      role: 'regle-basse',
      x: 0,
      y: ySponsors,
      largeur,
      hauteur: TRAITS.regle,
      remplissage: couleurAccent,
    },
  ];
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
  const noeuds: Noeud[] = [];

  // Blason : anneau rouge meme sur l'affiche jeunes, l'identite du club ne se
  // decline pas.
  // Le blason est le meilleur actif graphique du club : il porte le bandeau et
  // merite d'y occuper une vraie place.
  const dBlason = 184;
  const cxBlason = MARGE_X + dBlason / 2;
  const cyBlason = 112;
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
  const cadre = cadrerLogo(assets.blason, dBlason - 18);
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

  // Drapeau de journee : la seule information qui change chaque semaine.
  const largeurDrapeau = 188;
  const xDrapeau = FORMATS.portrait.largeur - MARGE_X - largeurDrapeau;
  const cxDrapeau = xDrapeau + largeurDrapeau / 2;
  noeuds.push({
    type: 'rect',
    role: 'drapeau',
    x: xDrapeau,
    y: 36,
    largeur: largeurDrapeau,
    hauteur: 164,
    rx: RAYONS.drapeau,
    remplissage: couleurAccent,
  });

  // « 1re », « 12e » : le rang et son exposant forment un seul bloc, centre
  // d'ensemble. Les couper sur deux lignes donnerait a lire « 1 / RE JOURNÉE ».
  const chiffre = String(numeroJournee);
  const exposant = ordinalJournee(numeroJournee).slice(chiffre.length);
  const styleChiffre = styleDisplay(100);
  const styleExposant = styleDisplay(38);
  const largeurChiffre = moteur.largeur(chiffre, styleChiffre);
  const largeurExposant = moteur.largeur(exposant, styleExposant);
  const xRang = cxDrapeau - (largeurChiffre + largeurExposant) / 2;
  const baseRang = moteur.ligneDeBaseCentree(styleChiffre, 108);

  noeuds.push({
    type: 'texte',
    role: 'numero-journee',
    x: xRang,
    y: baseRang,
    contenu: chiffre,
    famille: POLICES.display,
    graisse: GRAISSES.display,
    taille: styleChiffre.taille,
    couleur: COULEURS.blanc,
    largeurMesuree: largeurChiffre,
    hauteurMesuree: moteur.hauteurLigne(styleChiffre),
  });
  noeuds.push({
    type: 'texte',
    role: 'exposant-journee',
    x: xRang + largeurChiffre,
    y: baseRang - styleChiffre.taille * 0.52,
    contenu: exposant,
    famille: POLICES.display,
    graisse: GRAISSES.display,
    taille: styleExposant.taille,
    couleur: COULEURS.blanc,
    largeurMesuree: largeurExposant,
    hauteurMesuree: moteur.hauteurLigne(styleExposant),
  });

  const styleSuffixe = styleTexte(22, GRAISSES.fort, INTERLETTRAGE.capitales);
  noeuds.push({
    type: 'texte',
    role: 'libelle-journee',
    x: cxDrapeau,
    y: 182,
    contenu: 'JOURNÉE',
    famille: POLICES.texte,
    graisse: GRAISSES.fort,
    taille: styleSuffixe.taille,
    couleur: COULEURS.blanc,
    ancre: 'middle',
    interlettrage: INTERLETTRAGE.capitales,
    opacite: 0.85,
    largeurMesuree: moteur.largeur('JOURNÉE', styleSuffixe),
    hauteurMesuree: moteur.hauteurLigne(styleSuffixe),
  });

  // Bloc titre, ajuste a la place reellement disponible entre blason et drapeau.
  const xTitre = cxBlason + dBlason / 2 + ESPACES.s4;
  const largeurTitre = xDrapeau - ESPACES.s4 - xTitre;

  const surtitre = (options.surtitre ?? 'CHAMPIONNAT PAR ÉQUIPES').toUpperCase();
  const styleSur = styleTexte(30, GRAISSES.fort, INTERLETTRAGE.capitales);
  const surAjuste = moteur.ajuster(surtitre, largeurTitre, styleSur, echelonsDepuis(30, 18));
  noeuds.push({
    type: 'texte',
    role: 'surtitre',
    x: xTitre,
    y: 92,
    contenu: surtitre,
    famille: POLICES.texte,
    graisse: GRAISSES.fort,
    taille: surAjuste.taille,
    couleur: COULEURS.blanc,
    interlettrage: INTERLETTRAGE.capitales,
    opacite: 0.78,
    largeurMesuree: surAjuste.largeur,
    hauteurMesuree: moteur.hauteurLigne({ ...styleSur, taille: surAjuste.taille }),
  });

  const titre =
    affiche.categorie === 'jeunes' ? 'LES RENCONTRES JEUNES' : 'LES RENCONTRES DU WEEK-END';
  const styleTitre = styleDisplay(58);
  const titreAjuste = moteur.ajuster(titre, largeurTitre, styleTitre, echelonsDepuis(58, 30));
  noeuds.push({
    type: 'texte',
    role: 'titre',
    x: xTitre,
    y: 168,
    contenu: titre,
    famille: POLICES.display,
    graisse: GRAISSES.display,
    taille: titreAjuste.taille,
    couleur: COULEURS.blanc,
    largeurMesuree: titreAjuste.largeur,
    hauteurMesuree: moteur.hauteurLigne({ ...styleTitre, taille: titreAjuste.taille }),
  });

  return noeuds;
}

interface ContexteRangee {
  densite: Densite;
  moteur: MoteurTexte;
  assets: AssetsAffiche;
  couleurAccent: string;
  nomClub: string;
  decoupes: Decoupe[];
  diagnostics: Diagnostic[];
}

function rangee(
  rencontre: Rencontre,
  domicile: boolean,
  x: number,
  y: number,
  largeur: number,
  indice: string,
  ctx: ContexteRangee,
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
    remplissage: COULEURS.blanc,
  });

  // Le filet porte la couleur du lieu : l'information est ainsi encodee par la
  // forme et par la couleur, donc lisible en vignette et sans distinction fine
  // des teintes.
  const xFilet = x + largeur / 2 - densite.largeurFilet / 2;
  noeuds.push({
    type: 'rect',
    role: 'filet',
    x: xFilet,
    y: y + 10,
    largeur: densite.largeurFilet,
    hauteur: h - 20,
    rx: RAYONS.filet,
    remplissage: domicile ? ctx.couleurAccent : COULEURS.bleuProfond,
  });

  const d = densite.diametreLogo;
  const marge = 10;
  const cxGauche = x + marge + d / 2;
  const cxDroite = x + largeur - marge - d / 2;

  // Le blason du club reste toujours a gauche, au lieu de changer de cote
  // selon le lieu comme sur les anciennes affiches : l'oeil retrouve « nous »
  // au meme endroit sur chaque ligne, et les logos adverses heterogenes sont
  // confines a une seule colonne.
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
    ),
  );

  const styleNom = styleTexte(densite.tailleNom, GRAISSES.fort);
  const echelons = echelonsDepuis(densite.tailleNom, PLANCHERS.tailleNom);

  // Champ gauche : pastille de division puis nom du club.
  const xTexteGauche = cxGauche + d / 2 + ESPACES.s2;
  let curseur = xTexteGauche;

  if (rencontre.equipeLocale.division) {
    const stylePuce = styleTexte(densite.taillePuce, GRAISSES.fort, 0.03);
    const largeurTexte = moteur.largeur(rencontre.equipeLocale.division, stylePuce);
    const largeurPuce = largeurTexte + ESPACES.s2 * 1.5;
    noeuds.push({
      type: 'rect',
      role: 'puce-division',
      x: curseur,
      y: cy - densite.hauteurPuce / 2,
      largeur: largeurPuce,
      hauteur: densite.hauteurPuce,
      rx: RAYONS.puce,
      remplissage: COULEURS.encre,
    });
    noeuds.push({
      type: 'texte',
      role: 'division',
      x: curseur + largeurPuce / 2,
      y: moteur.ligneDeBaseCentree(stylePuce, cy),
      contenu: rencontre.equipeLocale.division,
      famille: POLICES.texte,
      graisse: GRAISSES.fort,
      taille: stylePuce.taille,
      couleur: COULEURS.blanc,
      ancre: 'middle',
      interlettrage: 0.03,
      largeurMesuree: largeurTexte,
      hauteurMesuree: moteur.hauteurLigne(stylePuce),
    });
    curseur += largeurPuce + ESPACES.s2;
  }

  const nomLocal = `${ctx.nomClub} ${rencontre.equipeLocale.numero}`;
  const placeGauche = xFilet - ESPACES.s3 - curseur;
  const localAjuste = moteur.ajuster(nomLocal, placeGauche, styleNom, echelons);
  noeuds.push({
    type: 'texte',
    role: 'nom-local',
    x: curseur,
    y: moteur.ligneDeBaseCentree({ ...styleNom, taille: localAjuste.taille }, cy),
    contenu: nomLocal,
    famille: POLICES.texte,
    graisse: GRAISSES.fort,
    taille: localAjuste.taille,
    couleur: COULEURS.encre,
    largeurMesuree: localAjuste.largeur,
    hauteurMesuree: moteur.hauteurLigne({ ...styleNom, taille: localAjuste.taille }),
  });

  // Champ droit : aligne a droite, le texte croit donc vers le filet.
  const xTexteDroite = cxDroite - d / 2 - ESPACES.s2;
  const placeDroite = xTexteDroite - (xFilet + densite.largeurFilet + ESPACES.s3);
  const styleAdverse = styleTexte(densite.tailleNom, GRAISSES.courant);
  const adverseAjuste = moteur.ajuster(
    rencontre.adversaire.libelle,
    placeDroite,
    styleAdverse,
    echelons,
  );
  if (adverseAjuste.deborde) {
    ctx.diagnostics.push({
      niveau: 'alerte',
      message: `« ${rencontre.adversaire.libelle} » est trop long pour sa ligne.`,
    });
  }
  noeuds.push({
    type: 'texte',
    role: 'nom-adverse',
    x: xTexteDroite,
    y: moteur.ligneDeBaseCentree({ ...styleAdverse, taille: adverseAjuste.taille }, cy),
    contenu: rencontre.adversaire.libelle,
    famille: POLICES.texte,
    graisse: GRAISSES.courant,
    taille: adverseAjuste.taille,
    couleur: COULEURS.encre,
    ancre: 'end',
    opacite: 0.92,
    largeurMesuree: adverseAjuste.largeur,
    hauteurMesuree: moteur.hauteurLigne({ ...styleAdverse, taille: adverseAjuste.taille }),
  });

  return noeuds;
}

function enteteGroupe(groupe: Groupe, x: number, y: number, ctx: ContexteRangee): Noeud[] {
  const { densite, moteur } = ctx;
  const libelleLieu = groupe.domicile ? 'À DOMICILE' : "À L'EXTÉRIEUR";
  const hOnglet = Math.min(38, densite.hauteurEnteteGroupe * 0.62);
  const styleOnglet = styleTexte(hOnglet * 0.58, GRAISSES.fort, INTERLETTRAGE.capitales);
  const largeurTexte = moteur.largeur(libelleLieu, styleOnglet);
  const largeurOnglet = largeurTexte + ESPACES.s5;
  const cyOnglet = y + hOnglet / 2;

  const noeuds: Noeud[] = [
    {
      type: 'rect',
      role: 'onglet-lieu',
      x,
      y,
      largeur: largeurOnglet,
      hauteur: hOnglet,
      rx: hOnglet / 2,
      remplissage: groupe.domicile ? ctx.couleurAccent : 'none',
      contour: groupe.domicile ? undefined : COULEURS.blanc,
      epaisseur: groupe.domicile ? undefined : TRAITS.ongletExterieur,
    },
    {
      type: 'texte',
      role: 'lieu',
      x: x + largeurOnglet / 2,
      y: moteur.ligneDeBaseCentree(styleOnglet, cyOnglet),
      contenu: libelleLieu,
      famille: POLICES.texte,
      graisse: GRAISSES.fort,
      taille: styleOnglet.taille,
      couleur: COULEURS.blanc,
      ancre: 'middle',
      interlettrage: INTERLETTRAGE.capitales,
      largeurMesuree: largeurTexte,
      hauteurMesuree: moteur.hauteurLigne(styleOnglet),
    },
  ];

  // Le libelle saisi a la main prime, pour que les journees importees
  // impriment exactement le texte d'origine.
  const date = groupe.creneau.libelleOverride ?? formatCreneau(groupe.creneau.debutIso);
  const styleDate = styleTexte(Math.max(18, hOnglet * 0.66), GRAISSES.appuye);
  noeuds.push({
    type: 'texte',
    role: 'date',
    x: x + largeurOnglet + ESPACES.s3,
    y: moteur.ligneDeBaseCentree(styleDate, cyOnglet),
    contenu: date,
    famille: POLICES.texte,
    graisse: GRAISSES.appuye,
    taille: styleDate.taille,
    couleur: COULEURS.blanc,
    opacite: OPACITES.secondaire,
    largeurMesuree: moteur.largeur(date, styleDate),
    hauteurMesuree: moteur.hauteurLigne(styleDate),
  });

  return noeuds;
}

function bandeSponsors(assets: AssetsAffiche, format: NomFormat, moteur: MoteurTexte): Noeud[] {
  const yBande = FORMATS[format].hauteur - HAUTEUR_SPONSORS;
  const cyCellules = yBande + 88;
  const noeuds: Noeud[] = [];

  const mention = 'Ils font vivre le club';
  const styleMention = styleTexte(22, GRAISSES.appuye);
  noeuds.push({
    type: 'texte',
    role: 'mention-sponsors',
    x: MARGE_X,
    y: moteur.ligneDeBaseCentree(styleMention, cyCellules),
    contenu: mention,
    famille: POLICES.texte,
    graisse: GRAISSES.appuye,
    taille: styleMention.taille,
    couleur: COULEURS.encre,
    opacite: OPACITES.tertiaire,
    largeurMesuree: moteur.largeur(mention, styleMention),
    hauteurMesuree: moteur.hauteurLigne(styleMention),
  });

  assets.sponsors.slice(0, 3).forEach((sponsor, i) => {
    const xCellule = SPONSORS_MEP.x0 + i * (SPONSORS_MEP.largeurCellule + SPONSORS_MEP.ecart);
    const utileL = SPONSORS_MEP.largeurCellule - 2 * SPONSORS_MEP.retrait;
    const utileH = SPONSORS_MEP.hauteurCellule - 2 * SPONSORS_MEP.retrait;
    const ratio = sponsor.hauteur > 0 ? sponsor.largeur / sponsor.hauteur : 1;

    let largeur = utileL;
    let hauteur = utileL / ratio;
    if (hauteur > utileH) {
      hauteur = utileH;
      largeur = utileH * ratio;
    }
    // Un logotype presque carre parait plus lourd qu'un logotype large a
    // surface egale : on le reduit legerement pour egaliser le poids optique.
    if (ratio < SPONSORS_MEP.ratioLarge) {
      largeur *= SPONSORS_MEP.reductionCarre;
      hauteur *= SPONSORS_MEP.reductionCarre;
    }

    noeuds.push({
      type: 'image',
      role: 'sponsor',
      x: xCellule + (SPONSORS_MEP.largeurCellule - largeur) / 2,
      y: cyCellules - hauteur / 2,
      largeur,
      hauteur,
      source: sponsor.source,
    });
  });

  return noeuds;
}

/** Hauteur occupee par un groupe, en-tete comprise. */
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

  const nbRencontres = affiche.groupes.reduce((t, g) => t + g.rencontres.length, 0);
  const densite = calculerDensite(nbRencontres, affiche.groupes.length, format);

  const decoupes: Decoupe[] = [];
  const diagnostics: Diagnostic[] = [];
  const ctx: ContexteRangee = {
    densite,
    moteur,
    assets,
    couleurAccent,
    nomClub: options.nomClub ?? NOM_CLUB_DEFAUT,
    decoupes,
    diagnostics,
  };

  const zoneContenu: Boite = {
    x: MARGE_X,
    y: HAUTEUR_BANDEAU + PADDING_CONTENU_Y,
    largeur: LARGEUR_UTILE,
    hauteur: hauteur - HAUTEUR_BANDEAU - HAUTEUR_SPONSORS - 2 * PADDING_CONTENU_Y,
  };

  const noeuds: Noeud[] = [
    ...fond(format, couleurAccent),
    ...bandeau(affiche, numeroJournee, assets, moteur, decoupes, options),
  ];

  const colonnes =
    densite.colonnes === 2
      ? repartirEnColonnes(affiche.groupes, (g) => hauteurGroupe(g, densite))
      : [affiche.groupes, []];

  const largeurColonne =
    densite.colonnes === 2 ? (zoneContenu.largeur - ESPACES.s6) / 2 : zoneContenu.largeur;

  colonnes.forEach((groupes, iColonne) => {
    const xColonne = zoneContenu.x + iColonne * (largeurColonne + ESPACES.s6);
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

  noeuds.push(...bandeSponsors(assets, format, moteur));

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
  if (assets.sponsors.length < 3) {
    diagnostics.push({
      niveau: 'alerte',
      message: `Seulement ${assets.sponsors.length} sponsor(s) sur 3.`,
    });
  }

  return { scene: { largeur, hauteur, decoupes, noeuds }, densite, diagnostics, zoneContenu };
}
