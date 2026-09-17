/* Genere par tools/build-assets.ts depuis images/logo_sponsors/. Ne pas modifier a la main. */

export interface EntreeSponsor {
  readonly id: string;
  readonly libelle: string;
  readonly fichier: string;
  readonly largeur: number;
  readonly hauteur: number;
  /** Un sponsor inactif reste consultable mais sort du tirage. */
  readonly actif: boolean;
}

export const SPONSORS = {
  'carrefour': {
    id: 'carrefour',
    libelle: 'Carrefour',
    fichier: 'carrefour.jpg',
    largeur: 225,
    hauteur: 225,
    actif: true,
  },
  'desloges': {
    id: 'desloges',
    libelle: 'Desloges',
    fichier: 'desloges.jpg',
    largeur: 173,
    hauteur: 300,
    actif: true,
  },
  'gl-meca-tp': {
    id: 'gl-meca-tp',
    libelle: 'Gl Meca Tp',
    fichier: 'gl-meca-tp.jpg',
    largeur: 480,
    hauteur: 165,
    actif: true,
  },
  'le-momparnasse': {
    id: 'le-momparnasse',
    libelle: 'Le Momparnasse',
    fichier: 'le-momparnasse.jpg',
    largeur: 450,
    hauteur: 300,
    actif: true,
  },
  'les-ateliers-de-sandy': {
    id: 'les-ateliers-de-sandy',
    libelle: 'Les Ateliers De Sandy',
    fichier: 'les-ateliers-de-sandy.jpg',
    largeur: 430,
    hauteur: 300,
    actif: true,
  },
  'pan-o-et-beaute': {
    id: 'pan-o-et-beaute',
    libelle: 'Pan O Et Beaute',
    fichier: 'pan-o-et-beaute.jpg',
    largeur: 480,
    hauteur: 259,
    actif: true,
  },
  'sarl-dimitri-caillet': {
    id: 'sarl-dimitri-caillet',
    libelle: 'Sarl Dimitri Caillet',
    fichier: 'sarl-dimitri-caillet.jpg',
    largeur: 464,
    hauteur: 300,
    actif: true,
  },
  'sarl-sorbet-derisbourg': {
    id: 'sarl-sorbet-derisbourg',
    libelle: 'Sarl Sorbet Derisbourg',
    fichier: 'sarl-sorbet-derisbourg.jpg',
    largeur: 480,
    hauteur: 236,
    actif: true,
  },
  'simoes-picaut': {
    id: 'simoes-picaut',
    libelle: 'Simoes Picaut',
    fichier: 'simoes-picaut.jpg',
    largeur: 274,
    hauteur: 184,
    actif: true,
  },
  'super-u': {
    id: 'super-u',
    libelle: 'Super U',
    fichier: 'super-u.png',
    largeur: 50,
    hauteur: 49,
    actif: true,
  },
  'art-mongolfieres-logo': {
    id: 'art-mongolfieres-logo',
    libelle: 'Art Mongolfieres Logo',
    fichier: 'art-mongolfieres-logo.jpg',
    largeur: 480,
    hauteur: 183,
    actif: true,
  },
  'atelier-du-chatelier-3': {
    id: 'atelier-du-chatelier-3',
    libelle: 'Atelier Du Chatelier 3',
    fichier: 'atelier-du-chatelier-3.jpg',
    largeur: 300,
    hauteur: 300,
    actif: true,
  },
  'bijouterie-c-lesage': {
    id: 'bijouterie-c-lesage',
    libelle: 'Bijouterie C Lesage',
    fichier: 'bijouterie-c-lesage.jpg',
    largeur: 473,
    hauteur: 300,
    actif: true,
  },
  'la-boutique-du-menuisier': {
    id: 'la-boutique-du-menuisier',
    libelle: 'La Boutique Du Menuisier',
    fichier: 'la-boutique-du-menuisier.jpg',
    largeur: 225,
    hauteur: 225,
    actif: true,
  },
  'le-week-end': {
    id: 'le-week-end',
    libelle: 'Le Week End',
    fichier: 'le-week-end.jpg',
    largeur: 299,
    hauteur: 300,
    actif: true,
  },
  'logo-piscine-eg41-contact': {
    id: 'logo-piscine-eg41-contact',
    libelle: 'Logo Piscine Eg41 Contact',
    fichier: 'logo-piscine-eg41-contact.png',
    largeur: 480,
    hauteur: 82,
    actif: true,
  },
  'misterping': {
    id: 'misterping',
    libelle: 'Misterping',
    fichier: 'misterping.png',
    largeur: 480,
    hauteur: 240,
    actif: true,
  },
  'paris-simoneau': {
    id: 'paris-simoneau',
    libelle: 'Paris Simoneau',
    fichier: 'paris-simoneau.jpg',
    largeur: 194,
    hauteur: 88,
    actif: true,
  },
  'sirap': {
    id: 'sirap',
    libelle: 'Sirap',
    fichier: 'sirap.jpg',
    largeur: 270,
    hauteur: 131,
    actif: false,
  },
  'as-autosecurite': {
    id: 'as-autosecurite',
    libelle: 'As Autosecurite',
    fichier: 'as-autosecurite.jpg',
    largeur: 480,
    hauteur: 172,
    actif: false,
  },
  'logo-sultan-kebab-blere': {
    id: 'logo-sultan-kebab-blere',
    libelle: 'Logo Sultan Kebab Blere',
    fichier: 'logo-sultan-kebab-blere.jpg',
    largeur: 300,
    hauteur: 300,
    actif: false,
  },
} as const satisfies Record<string, EntreeSponsor>;

export type SponsorId = keyof typeof SPONSORS;
