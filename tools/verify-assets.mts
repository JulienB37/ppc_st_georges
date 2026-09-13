/**
 * Verifie que les registres generes decrivent bien la bibliotheque livree.
 *
 * Le scenario a attraper est banal : quelqu'un depose un logo dans
 * `images/logo_club/` et oublie de relancer `assets:build`. Sans ce controle,
 * le club reste introuvable a l'execution, et on ne le decouvre que sur une
 * affiche publiee.
 *
 * Ne retraite aucune image : rapide, deterministe, sans dependance native.
 *
 * Usage : node --experimental-strip-types tools/verify-assets.ts
 */
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';

import { clubIdDepuisFichier } from '../projects/poster-core/src/clubs/normaliser.ts';
import { CLUBS } from '../projects/poster-core/src/clubs/registre.generated.ts';
import { SPONSORS } from '../projects/poster-core/src/sponsors/registre.generated.ts';

const RACINE = path.resolve(import.meta.dirname, '..');
const IMAGES = /\.(png|jpe?g)$/i;
const PARASITES = /~$/;

async function idsSources(dossier: string, exclure: string[] = []): Promise<Set<string>> {
  const entrees = await readdir(dossier, { withFileTypes: true });
  return new Set(
    entrees
      .filter(
        (d) =>
          d.isFile() && IMAGES.test(d.name) && !PARASITES.test(d.name) && !exclure.includes(d.name),
      )
      .map((d) => clubIdDepuisFichier(d.name)),
  );
}

function comparer(quoi: string, sources: Set<string>, registre: Set<string>): string[] {
  const erreurs: string[] = [];
  for (const id of sources) {
    if (!registre.has(id)) erreurs.push(`${quoi} : « ${id} » livre mais absent du registre`);
  }
  for (const id of registre) {
    if (!sources.has(id)) erreurs.push(`${quoi} : « ${id} » au registre mais plus livre`);
  }
  return erreurs;
}

async function main(): Promise<void> {
  const erreurs: string[] = [];

  erreurs.push(
    ...comparer(
      'clubs',
      // `default.png` est volontairement ecarte : un logo introuvable devient
      // un monogramme.
      await idsSources(path.join(RACINE, 'images/logo_club'), ['default.png']),
      new Set(Object.keys(CLUBS)),
    ),
  );

  const sponsorsSources = new Set([
    ...(await idsSources(path.join(RACINE, 'images/logo_sponsors'))),
    ...(await idsSources(path.join(RACINE, 'images/logo_sponsors/ancien'))),
  ]);
  erreurs.push(...comparer('sponsors', sponsorsSources, new Set(Object.keys(SPONSORS))));

  // Chaque fichier annonce doit exister la ou l'application ira le chercher.
  for (const [dossier, entrees] of [
    ['projects/app/public/assets/clubs', Object.values(CLUBS)],
    ['projects/app/public/assets/sponsors', Object.values(SPONSORS)],
  ] as const) {
    for (const entree of entrees) {
      try {
        await access(path.join(RACINE, dossier, entree.fichier));
      } catch {
        erreurs.push(`${dossier}/${entree.fichier} annonce au registre mais absent du disque`);
      }
    }
  }

  if (erreurs.length) {
    console.error(`${erreurs.length} incoherence(s) entre la bibliotheque et les registres :\n`);
    for (const e of erreurs) console.error(`  - ${e}`);
    console.error(`\nRelancez : npm run assets:build`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Registres a jour : ${Object.keys(CLUBS).length} clubs, ${Object.keys(SPONSORS).length} sponsors.`,
  );
}

await main();
