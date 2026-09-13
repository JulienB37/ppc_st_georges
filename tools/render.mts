/**
 * Rend une journee en SVG et en PNG, sans interface.
 *
 * Sert a comparer le nouveau moteur a l'ancien (`npm run render:legacy`) sur
 * les memes donnees, et a regarder un rendu reel sans attendre l'application.
 *
 * Usage : npm run render -- [chemin/vers/journee_config.json] [--annee 2026]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { initWasm, Resvg } from '@resvg/resvg-wasm';

import { CLUBS } from '../projects/poster-core/src/clubs/registre.generated.ts';
import {
  composerAffiche,
  type AssetsAffiche,
  type LogoResolu,
  type SponsorResolu,
} from '../projects/poster-core/src/render/affiche.ts';
import { creerMoteurTexte, type FacePolice } from '../projects/poster-core/src/layout/mesure.ts';
import { emettreSvg } from '../projects/poster-core/src/render/emettre.ts';
import { migrerDepuisV1 } from '../projects/poster-core/src/migrate/v1.ts';
import { tirerSponsors } from '../projects/poster-core/src/sponsors/tirage.ts';
import type { Journee } from '../projects/poster-core/src/model/journee.ts';

const RACINE = path.resolve(import.meta.dirname, '..');
const ASSETS = path.join(RACINE, 'projects/app/public/assets');
const SORTIE = path.join(RACINE, 'resultats/nouveau');
const WASM = path.join(RACINE, 'node_modules/@resvg/resvg-wasm/index_bg.wasm');

const MIMES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

async function dataUrl(chemin: string): Promise<string> {
  const octets = await readFile(chemin);
  const mime = MIMES[path.extname(chemin).toLowerCase()] ?? 'image/png';
  return `data:${mime};base64,${octets.toString('base64')}`;
}

async function chargerPolices(): Promise<{ faces: FacePolice[]; tampons: Uint8Array[] }> {
  const manifeste = JSON.parse(
    await readFile(path.join(ASSETS, 'fonts/fonts.manifest.json'), 'utf8'),
  ) as { faces: { fichier: string; famille: string; graisse: number }[] };

  const faces: FacePolice[] = [];
  const tampons: Uint8Array[] = [];
  for (const face of manifeste.faces) {
    const donnees = new Uint8Array(await readFile(path.join(ASSETS, 'fonts', face.fichier)));
    faces.push({ famille: face.famille, graisse: face.graisse, donnees });
    tampons.push(donnees);
  }
  return { faces, tampons };
}

async function chargerAssets(journee: Journee, indexAffiche: number): Promise<AssetsAffiche> {
  const affiche = journee.affiches[indexAffiche]!;

  const blasonEntree = CLUBS['pp-st-georgescher'];
  const blason: LogoResolu = {
    source: await dataUrl(path.join(ASSETS, 'clubs', blasonEntree.fichier)),
    largeur: blasonEntree.largeur,
    hauteur: blasonEntree.hauteur,
  };

  const logos = new Map<string, LogoResolu>();
  for (const groupe of affiche.groupes) {
    for (const rencontre of groupe.rencontres) {
      const id = rencontre.adversaire.clubId;
      if (logos.has(id)) continue;
      const entree = (CLUBS as Record<string, (typeof CLUBS)[keyof typeof CLUBS]>)[id];
      if (!entree) continue;
      logos.set(id, {
        source: await dataUrl(path.join(ASSETS, 'clubs', entree.fichier)),
        largeur: entree.largeur,
        hauteur: entree.hauteur,
      });
    }
  }

  const sponsors: SponsorResolu[] = [];
  for (const entree of tirerSponsors(affiche.sponsors)) {
    sponsors.push({
      id: entree.id,
      source: await dataUrl(path.join(ASSETS, 'sponsors', entree.fichier)),
      largeur: entree.largeur,
      hauteur: entree.hauteur,
    });
  }

  return { blason, logos, sponsors };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const drapeauAnnee = args.indexOf('--annee');
  const anneeSaison = drapeauAnnee >= 0 ? Number(args[drapeauAnnee + 1]) : 2026;
  const entree = args.find((a) => !a.startsWith('--') && a !== String(anneeSaison));

  const chemin = entree
    ? path.resolve(RACINE, entree)
    : path.join(RACINE, 'legacy/journee_config.json');

  const brut = JSON.parse(await readFile(chemin, 'utf8')) as unknown;
  const { journee, avertissements } = migrerDepuisV1(brut, { anneeSaison });

  for (const a of avertissements) console.warn(`  avertissement : ${a}`);

  await initWasm(await readFile(WASM));
  const { faces, tampons } = await chargerPolices();
  const moteur = creerMoteurTexte(faces);
  await mkdir(SORTIE, { recursive: true });

  for (const [i, affiche] of journee.affiches.entries()) {
    const assets = await chargerAssets(journee, i);
    const { scene, densite, diagnostics } = composerAffiche(
      affiche,
      journee.numero,
      assets,
      moteur,
    );

    const svg = emettreSvg(scene);
    const base = `J${journee.numero}_${affiche.categorie}`;
    await writeFile(path.join(SORTIE, `${base}.svg`), svg);

    const rendu = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1080 },
      font: { fontBuffers: tampons, loadSystemFonts: false },
    });
    const png = rendu.render().asPng();
    await writeFile(path.join(SORTIE, `${base}.png`), png);

    console.log(
      `${base.padEnd(18)} ${affiche.groupes.length} créneau(x), ` +
        `${affiche.groupes.reduce((t, g) => t + g.rencontres.length, 0)} rencontre(s), ` +
        `variante ${densite.variante} (${densite.strategie}, ×${densite.facteur.toFixed(2)}), ` +
        `SVG ${(svg.length / 1024).toFixed(0)} Ko, PNG ${(png.length / 1024).toFixed(0)} Ko`,
    );
    for (const d of diagnostics)
      console.log(`   ${d.niveau === 'alerte' ? '!' : '-'} ${d.message}`);
  }

  console.log(`\nSorties dans ${path.relative(RACINE, SORTIE)}/`);
}

await main();
