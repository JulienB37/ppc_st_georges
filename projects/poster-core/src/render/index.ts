/*
 * Point d'entree du moteur de rendu, SEPARE de `public-api.ts`.
 *
 * Il tire la composition, l'emetteur SVG, les traces vectoriels generes
 * (pinceau, eclaboussure, anneau) et la mesure de texte par fontkit — soit
 * l'essentiel du poids de la librairie. L'exporter depuis la barre principale
 * le rendrait solidaire de tout import de `poster-core` : la page d'historique,
 * qui ne veut qu'un ordinal et un format de date, embarquerait le moteur
 * entier.
 *
 * Trois points d'entree, donc, du plus leger au plus lourd :
 *   poster-core             modele, formats, clubs, edition, tirage des sponsors
 *   poster-core/render      composition, emission SVG, mesure de texte
 *   poster-core/rasterize   resvg et son wasm
 */
export * from './affiche';
export * from './emettre';
export * from './scene';
export * from './tokens';
export * from '../layout/mesure';
export * from '../layout/densite';
export * from '../fond/registre.generated';
