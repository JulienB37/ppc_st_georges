/*
 * Point d'entree du rasteriseur, SEPARE de `public-api.ts`.
 *
 * Il tire `@resvg/resvg-wasm`, soit 2,4 Mo de wasm. L'exporter depuis la barre
 * principale le rendrait solidaire de tout import de `poster-core` — modele,
 * formatage, resolution de club — et l'application le chargerait au demarrage
 * alors qu'il n'est utile qu'a l'ouverture de l'editeur.
 *
 * Deux points d'entree, donc, et un chargement paresseux possible :
 *   import { creerClientRendu } from 'poster-core/rasterize';
 */
export * from './moteur';
export * from './protocole';
export * from './worker';
export * from './client';
