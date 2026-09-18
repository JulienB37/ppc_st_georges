/**
 * Teintes de creneau, cote interface.
 *
 * Ce sont celles de l'affiche, dans leur version VIVE. Le moteur de rendu les
 * utilise foncees, parce qu'il y pose du texte blanc ; l'interface les emploie
 * en traits et en reperes sur un fond sombre, ou la version claire se detache.
 * Meme cycle, meme ordre : un creneau garde sa couleur de la saisie a l'export.
 */
export const TEINTES_CRENEAU_UI = ['#DE1B4B', '#1FA9B4', '#8B3FAE', '#E08A1E'] as const;
