/*
 * poster-core — moteur d'affiches PPC St Georges/Cher.
 *
 * TypeScript pur : le meme code tourne dans le navigateur, dans un worker,
 * dans Node (tests et images de reference) et dans le renderer Electron.
 * Aucun acces au systeme de fichiers : les assets arrivent deja resolus.
 */

export * from './format/ordinal';
export * from './format/creneau';

export * from './clubs/normaliser';
export * from './clubs/resoudre';
export * from './clubs/registre.generated';
export * from './sponsors/registre.generated';

export * from './model/journee';
export * from './migrate/v1';

export * from './edition/modele';
export * from './edition/mutations';
