import { describe, expect, it } from 'vitest';

import { POLICES } from '../render/tokens';
import { creerMoteurTexte, echelonsDepuis } from './mesure';
import { chargerPolicesLivrees } from './polices.fixture';

const moteur = creerMoteurTexte(chargerPolicesLivrees());

const TEXTE = { famille: POLICES.texte, graisse: 600, taille: 34 } as const;

describe('creerMoteurTexte', () => {
  it('refuse une graisse non livree plutot que d en rendre une autre', () => {
    // resvg ne synthetise pas le gras : accepter ici reviendrait a rendre une
    // face differente de celle demandee, en silence.
    expect(() => moteur.largeur('Test', { ...TEXTE, graisse: 900 })).toThrow(/Graisse 900/);
    expect(() => moteur.largeur('Test', { ...TEXTE, famille: 'Comic Sans MS' })).toThrow(/Famille/);
  });

  it('refuse de se construire sans police', () => {
    expect(() => creerMoteurTexte([])).toThrow(/Aucune face/);
  });
});

describe('largeur', () => {
  it('croit avec la graisse, a texte et corps egaux', () => {
    const nom = 'ASJ La Chaussée St Victor 1';
    const largeurs = [500, 600, 700].map((graisse) => moteur.largeur(nom, { ...TEXTE, graisse }));
    expect(largeurs[0]!).toBeLessThan(largeurs[1]!);
    expect(largeurs[1]!).toBeLessThan(largeurs[2]!);
  });

  it('est proportionnelle au corps', () => {
    const a = moteur.largeur('Gien AS TT 1', { ...TEXTE, taille: 20 });
    const b = moteur.largeur('Gien AS TT 1', { ...TEXTE, taille: 40 });
    expect(b / a).toBeCloseTo(2, 5);
  });

  it('compte l interlettrage', () => {
    const sans = moteur.largeur('DOMICILE', TEXTE);
    const avec = moteur.largeur('DOMICILE', { ...TEXTE, interlettrage: 0.07 });
    expect(avec).toBeCloseTo(sans + 0.07 * TEXTE.taille * 'DOMICILE'.length, 5);
  });

  it('rend zero pour une chaine vide', () => {
    expect(moteur.largeur('', TEXTE)).toBe(0);
  });

  it('tient le nom le plus long du jeu de donnees dans un demi-rang', () => {
    // Champ de nom d'une rangee : 380 px a diametre de logo nominal.
    // C'est l'argument qui a fait retenir une condensee.
    const largeur = moteur.largeur('ASJ La Chaussée St Victor 1', { ...TEXTE, taille: 30 });
    expect(largeur).toBeLessThanOrEqual(380);
  });
});

describe('metriques et ligne de base', () => {
  it('rend des metriques plausibles', () => {
    const m = moteur.metriques(TEXTE);
    expect(m.ascendante).toBeGreaterThan(0.6);
    expect(m.ascendante).toBeLessThan(1.3);
    expect(m.descendante).toBeGreaterThan(0);
    expect(m.descendante).toBeLessThan(0.5);
  });

  it('centre les capitales sur leur propre hauteur', () => {
    const centre = 100;
    const base = moteur.ligneDeBaseCapitales(TEXTE, centre);
    const m = moteur.metriques(TEXTE);
    // L'encre d'une capitale occupe [base - capitale, base] : son centre doit
    // tomber exactement sur l'ordonnee demandee.
    expect(base - (m.capitale * TEXTE.taille) / 2).toBeCloseTo(centre, 6);
  });

  it('diverge du centrage sur boite em, et pas du meme cote selon la face', () => {
    // Mesure sur les faces livrees : Barlow Semi Condensed reserve 1,0 en
    // ascendante pour 0,7 de capitale, ce qui decale les capitales de +5 % du
    // corps ; Anton, plus genereuse en descendante, les decale de -0,6 %. Le
    // signe change donc d'une face a l'autre : c'est pourquoi la regle est
    // explicite plutot que deduite d'une face particuliere.
    const centre = 100;
    const ecart = (style: { famille: string; graisse: number; taille: number }) =>
      moteur.ligneDeBaseCapitales(style, centre) - moteur.ligneDeBaseCentree(style, centre);
    expect(ecart(TEXTE)).toBeLessThan(-1);
    expect(ecart({ famille: POLICES.display, graisse: 400, taille: 34 })).toBeGreaterThan(0);
  });

  it('centre verticalement sans recourir a dominant-baseline', () => {
    // L'interpretation de `dominant-baseline` diverge d'un moteur a l'autre :
    // la ligne de base est calculee ici, a partir des metriques reelles.
    const centre = 100;
    const base = moteur.ligneDeBaseCentree(TEXTE, centre);
    const m = moteur.metriques(TEXTE);
    const haut = base - m.ascendante * TEXTE.taille;
    const bas = base + m.descendante * TEXTE.taille;
    expect((haut + bas) / 2).toBeCloseTo(centre, 6);
  });
});

describe('glyphesManquants', () => {
  it('ne signale rien sur le francais courant des affiches', () => {
    const echantillon =
      "ASJ La Chaussée St Victor — Azé TT, L'aigle Sellois, Mont-près-Chambord, " +
      'Samedi 19 septembre à 18h00 — 1re JOURNÉE « Œuvre » 100 % 12e';
    expect(moteur.glyphesManquants(echantillon, TEXTE)).toEqual([]);
  });

  it('couvre le rang de journee dans la famille d affichage', () => {
    // Le rang de journee est le seul texte pose sur le gabarit, et il porte un
    // E accent aigu capital. Un sous-ensemble qui l'oublierait ne laisserait
    // qu'un trou dans la bande peinte, sans erreur.
    // Le test a deja paye : trois brosses candidates ont ete ecartees parce
    // qu'elles n'avaient ni « e » grave ni « e » aigu, et resvg les aurait
    // completees en silence avec une autre face.
    const style = { famille: POLICES.display, graisse: 400, taille: 40 };
    expect(moteur.glyphesManquants('1ère Journée jeunes', style)).toEqual([]);
  });

  it('demasque un caractere absent du sous-ensemble', () => {
    // Un sous-ensemblage trop agressif, ou un copier-coller exotique, ne doit
    // pas produire un rectangle vide sur l'affiche sans prevenir.
    const manquants = moteur.glyphesManquants('Tournoi 東京', TEXTE);
    expect(manquants.map((m) => m.caractere)).toEqual(['東', '京']);
  });
});

describe('ajuster', () => {
  const echelons = echelonsDepuis(34, 20);

  it('garde le corps nominal quand le texte tient', () => {
    const r = moteur.ajuster('Azé TT 2', 380, TEXTE, echelons);
    expect(r.taille).toBe(34);
    expect(r.deborde).toBe(false);
  });

  it('reduit juste ce qu il faut', () => {
    const long = 'ASJ La Chaussée St Victor 1';
    const r = moteur.ajuster(long, 300, TEXTE, echelons);
    expect(r.taille).toBeLessThan(34);
    expect(r.largeur).toBeLessThanOrEqual(300);
    expect(r.deborde).toBe(false);
    // Un echelon de plus aurait suffi : on ne reduit pas plus que necessaire.
    const auDessus = moteur.largeur(long, { ...TEXTE, taille: r.taille + 2 });
    expect(auDessus).toBeGreaterThan(300);
  });

  it('avoue le debordement au lieu de descendre sous le plancher', () => {
    const r = moteur.ajuster('Un nom de club deraisonnablement long', 80, TEXTE, echelons);
    expect(r.taille).toBe(20);
    expect(r.deborde).toBe(true);
  });
});

describe('echelonsDepuis', () => {
  it('descend du nominal au plancher par pas reguliers', () => {
    expect(echelonsDepuis(34, 28)).toEqual([34, 32, 30, 28]);
  });

  it('atteint toujours le plancher, meme si le pas ne tombe pas juste', () => {
    expect(echelonsDepuis(34, 21).at(-1)).toBe(21);
  });
});
