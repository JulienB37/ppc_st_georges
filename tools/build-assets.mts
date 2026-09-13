/**
 * Normalise la bibliotheque d'images et produit les registres types.
 *
 * Entree  : images/logo_club/**, images/logo_sponsors/**
 * Sortie  : projects/app/public/assets/{clubs,sponsors}/*
 *           projects/poster-core/src/clubs/registre.generated.ts
 *           projects/poster-core/src/sponsors/registre.generated.ts
 *
 * Deux raisons d'exister :
 *
 * 1. Le navigateur ne sait pas parcourir un dossier. L'ancien script listait
 *    `images/logo_sponsors` au moment du rendu ; cote web il faut un inventaire
 *    connu a la compilation.
 * 2. Les fichiers livres pesent 5 Mo, portent des espaces et des accents dans
 *    leur nom, et melangent trois formats. Inutilisables tels quels comme URL,
 *    et hors de proportion pour des vignettes affichees a 90 px.
 *
 * Le registre genere donne des identifiants litteraux : referencer un logo qui
 * n'existe pas cesse de compiler.
 *
 * Usage : node --experimental-strip-types tools/build-assets.ts
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

// Source unique de verite pour la normalisation : la meme fonction que celle
// utilisee a l'execution pour rapprocher un nom saisi d'un club connu.
import { clubIdDepuisFichier } from '../projects/poster-core/src/clubs/normaliser.ts';

const RACINE = path.resolve(import.meta.dirname, '..');
const SRC_CLUBS = path.join(RACINE, 'images/logo_club');
const SRC_SPONSORS = path.join(RACINE, 'images/logo_sponsors');
const DEST_CLUBS = path.join(RACINE, 'projects/app/public/assets/clubs');
const DEST_SPONSORS = path.join(RACINE, 'projects/app/public/assets/sponsors');
const DEST_REGISTRES = path.join(RACINE, 'projects/poster-core/src');
const LABELS = path.join(RACINE, 'assets-src/clubs.labels.json');

/** 256 px suffit : a l'export 2160, la pastille de logo fait ~160 px. */
const TAILLE_CLUB = 256;
/** Les cellules sponsors font 232 x 116 sur une affiche de 1080 de large. */
const LARGEUR_SPONSOR = 480;
const HAUTEUR_SPONSOR = 300;

/** Budget par fichier, au-dela duquel on refuse de livrer. */
const BUDGET_OCTETS = 60 * 1024;

const IMAGES = /\.(png|jpe?g)$/i;
/** Fichiers de sauvegarde d'editeur, commites par accident. */
const PARASITES = /~$/;

interface Entree {
  id: string;
  libelle: string;
  fichier: string;
  largeur: number;
  hauteur: number;
  octets: number;
}

interface LabelsAtelier {
  [id: string]: { libelle?: string; alias?: string[] };
}

/** `aze-tt` -> `Aze Tt`. Approximation, corrigee a la main dans clubs.labels.json. */
function libelleDepuisId(id: string): string {
  return id
    .split('-')
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1))
    .join(' ');
}

async function fichiersImages(dossier: string): Promise<string[]> {
  const noms = await readdir(dossier, { withFileTypes: true });
  return noms
    .filter((d) => d.isFile() && IMAGES.test(d.name) && !PARASITES.test(d.name))
    .map((d) => d.name)
    .sort();
}

/**
 * Rogne les marges uniformes puis inscrit l'image dans un carre transparent.
 *
 * Le rognage homogeneise des logos dont les marges internes vont du simple au
 * triple : sans lui, deux blasons de meme taille apparente n'occupent pas la
 * meme surface dans leur pastille.
 */
async function traiterLogoClub(source: Buffer): Promise<Buffer> {
  const base = sharp(source);
  let rogne: sharp.Sharp;
  try {
    rogne = sharp(await base.trim({ threshold: 12 }).toBuffer());
  } catch {
    // Un logo d'une seule couleur, ou dont le rognage emporterait tout :
    // on le garde tel quel plutot que de produire une image vide.
    rogne = sharp(source);
  }
  // `inside` et non `contain` : `contain` remplit de transparent jusqu'au
  // carre, si bien que tous les logos se declaraient en 256x256 et que leur
  // rapport reel devenait invisible. Le cadrage dans la pastille les marginait
  // alors une seconde fois, et ils flottaient au milieu d'un disque trop grand.
  return rogne
    .resize(TAILLE_CLUB, TAILLE_CLUB, { fit: 'inside', withoutEnlargement: true })
    .png({ palette: true, quality: 90, effort: 9 })
    .toBuffer();
}

/**
 * Les sponsors gardent leur fond : c'est souvent une marque deposee dont la
 * couleur fait partie. On choisit PNG ou JPEG selon la presence de transparence.
 */
async function traiterLogoSponsor(source: Buffer): Promise<{ buffer: Buffer; extension: string }> {
  // `isOpaque` plutot que `hasAlpha` : plusieurs logos portent un canal alpha
  // entierement opaque, vestige de leur export. S'y fier imposerait un PNG la
  // ou un JPEG fait trois fois moins lourd pour un rendu identique.
  const { isOpaque } = await sharp(source).stats();
  const redimensionne = () =>
    sharp(source).resize(LARGEUR_SPONSOR, HAUTEUR_SPONSOR, {
      fit: 'inside',
      withoutEnlargement: true,
    });

  if (isOpaque) {
    return {
      buffer: await redimensionne()
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer(),
      extension: 'jpg',
    };
  }
  return {
    buffer: await redimensionne()
      .png({ palette: true, quality: 90, colours: 128, effort: 9 })
      .toBuffer(),
    extension: 'png',
  };
}

function citer(valeur: string): string {
  return `'${valeur.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

async function main(): Promise<void> {
  await rm(DEST_CLUBS, { recursive: true, force: true });
  await rm(DEST_SPONSORS, { recursive: true, force: true });
  await mkdir(DEST_CLUBS, { recursive: true });
  await mkdir(DEST_SPONSORS, { recursive: true });

  let labels: LabelsAtelier = {};
  try {
    labels = JSON.parse(await readFile(LABELS, 'utf8')) as LabelsAtelier;
  } catch {
    console.warn(
      `(${path.relative(RACINE, LABELS)} absent : libelles deduits des noms de fichiers)`,
    );
  }

  const avertissements: string[] = [];

  // ------------------------------------------------------------------ clubs
  const clubs: Entree[] = [];
  let octetsAvantClubs = 0;
  for (const nom of await fichiersImages(SRC_CLUBS)) {
    // `default.png` disparait : un logo introuvable devient un monogramme, qui
    // reste digne la ou un pictogramme generique ne l'est pas.
    if (nom === 'default.png') continue;

    const source = await readFile(path.join(SRC_CLUBS, nom));
    octetsAvantClubs += source.length;

    const id = clubIdDepuisFichier(nom);
    const buffer = await traiterLogoClub(source);
    const { width = 0, height = 0 } = await sharp(buffer).metadata();
    const fichier = `${id}.png`;
    await writeFile(path.join(DEST_CLUBS, fichier), buffer);

    if (buffer.length > BUDGET_OCTETS) {
      avertissements.push(
        `${fichier} pese ${(buffer.length / 1024).toFixed(0)} Ko (budget ${(BUDGET_OCTETS / 1024).toFixed(0)} Ko)`,
      );
    }
    if (!labels[id]?.libelle) {
      avertissements.push(`libelle manquant pour « ${id} » (deduit : « ${libelleDepuisId(id)} »)`);
    }

    clubs.push({
      id,
      libelle: labels[id]?.libelle ?? libelleDepuisId(id),
      fichier,
      largeur: width,
      hauteur: height,
      octets: buffer.length,
    });
  }

  // --------------------------------------------------------------- sponsors
  const sponsors: (Entree & { actif: boolean })[] = [];
  let octetsAvantSponsors = 0;
  for (const [dossier, actif] of [
    [SRC_SPONSORS, true],
    [path.join(SRC_SPONSORS, 'ancien'), false],
  ] as const) {
    for (const nom of await fichiersImages(dossier)) {
      const source = await readFile(path.join(dossier, nom));
      octetsAvantSponsors += source.length;

      const id = clubIdDepuisFichier(nom);
      const { buffer, extension } = await traiterLogoSponsor(source);
      const { width = 0, height = 0 } = await sharp(buffer).metadata();
      const fichier = `${id}.${extension}`;
      await writeFile(path.join(DEST_SPONSORS, fichier), buffer);

      if (buffer.length > BUDGET_OCTETS) {
        avertissements.push(
          `${fichier} pese ${(buffer.length / 1024).toFixed(0)} Ko (budget ${(BUDGET_OCTETS / 1024).toFixed(0)} Ko)`,
        );
      }

      sponsors.push({
        id,
        libelle: libelleDepuisId(id),
        fichier,
        largeur: width,
        hauteur: height,
        octets: buffer.length,
        actif,
      });
    }
  }

  // -------------------------------------------------------------- registres
  const enTete = (source: string) =>
    `/* Genere par tools/build-assets.ts depuis ${source}. Ne pas modifier a la main. */\n\n`;

  const clubsTs =
    enTete('images/logo_club/') +
    `export interface EntreeClub {\n` +
    `  readonly id: string;\n` +
    `  readonly libelle: string;\n` +
    `  readonly fichier: string;\n` +
    `  readonly largeur: number;\n` +
    `  readonly hauteur: number;\n` +
    `  readonly alias: readonly string[];\n` +
    `}\n\n` +
    `export const CLUBS = {\n` +
    clubs
      .map((c) => {
        const alias = labels[c.id]?.alias ?? [];
        return (
          `  ${citer(c.id)}: {\n` +
          `    id: ${citer(c.id)},\n` +
          `    libelle: ${citer(c.libelle)},\n` +
          `    fichier: ${citer(c.fichier)},\n` +
          `    largeur: ${c.largeur},\n` +
          `    hauteur: ${c.hauteur},\n` +
          `    alias: [${alias.map(citer).join(', ')}],\n` +
          `  },\n`
        );
      })
      .join('') +
    `} as const satisfies Record<string, EntreeClub>;\n\n` +
    `/** Identifiant litteral : referencer un club inexistant ne compile pas. */\n` +
    `export type ClubId = keyof typeof CLUBS;\n`;

  const sponsorsTs =
    enTete('images/logo_sponsors/') +
    `export interface EntreeSponsor {\n` +
    `  readonly id: string;\n` +
    `  readonly libelle: string;\n` +
    `  readonly fichier: string;\n` +
    `  readonly largeur: number;\n` +
    `  readonly hauteur: number;\n` +
    `  /** Un sponsor inactif reste consultable mais sort du tirage. */\n` +
    `  readonly actif: boolean;\n` +
    `}\n\n` +
    `export const SPONSORS = {\n` +
    sponsors
      .map(
        (s) =>
          `  ${citer(s.id)}: {\n` +
          `    id: ${citer(s.id)},\n` +
          `    libelle: ${citer(s.libelle)},\n` +
          `    fichier: ${citer(s.fichier)},\n` +
          `    largeur: ${s.largeur},\n` +
          `    hauteur: ${s.hauteur},\n` +
          `    actif: ${s.actif},\n` +
          `  },\n`,
      )
      .join('') +
    `} as const satisfies Record<string, EntreeSponsor>;\n\n` +
    `export type SponsorId = keyof typeof SPONSORS;\n`;

  await mkdir(path.join(DEST_REGISTRES, 'sponsors'), { recursive: true });
  await writeFile(path.join(DEST_REGISTRES, 'clubs/registre.generated.ts'), clubsTs);
  await writeFile(path.join(DEST_REGISTRES, 'sponsors/registre.generated.ts'), sponsorsTs);

  // ------------------------------------------------------------------ bilan
  const apresClubs = clubs.reduce((t, c) => t + c.octets, 0);
  const apresSponsors = sponsors.reduce((t, s) => t + s.octets, 0);
  const ko = (n: number) => `${(n / 1024).toFixed(0)} Ko`;

  console.log(`clubs    : ${clubs.length} logos, ${ko(octetsAvantClubs)} -> ${ko(apresClubs)}`);
  console.log(
    `sponsors : ${sponsors.length} logos (${sponsors.filter((s) => s.actif).length} actifs), ` +
      `${ko(octetsAvantSponsors)} -> ${ko(apresSponsors)}`,
  );
  console.log(
    `total    : ${ko(octetsAvantClubs + octetsAvantSponsors)} -> ${ko(apresClubs + apresSponsors)}`,
  );

  if (avertissements.length) {
    console.log(`\n${avertissements.length} avertissement(s) :`);
    for (const a of avertissements) console.log(`  - ${a}`);
  }
}

await main();
