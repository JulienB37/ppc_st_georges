/*
 * poster-core — moteur d'affiches PPC St Georges/Cher.
 *
 * TypeScript pur : le meme code tourne dans le navigateur, dans un worker,
 * dans Node (tests et images de reference) et dans le renderer Electron.
 * Aucun acces au systeme de fichiers : les assets arrivent deja resolus.
 */

export * from './format/ordinal';
export * from './format/creneau';
