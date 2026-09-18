/* Genere par tools/build-assets.ts depuis assets-src/fond/. Ne pas modifier a la main. */

export interface EntreeFond {
  readonly id: string;
  readonly fichier: string;
  readonly largeur: number;
  readonly hauteur: number;
  /** Largeur d'export a laquelle cette version est destinee. */
  readonly largeurCible: number;
}

export const FONDS = [
  {
    id: 'gabarit',
    fichier: 'gabarit-1080.jpg',
    largeur: 1024,
    hauteur: 1536,
    largeurCible: 1080,
  },
] as const satisfies readonly EntreeFond[];

/** Version la mieux adaptee a une largeur d'export donnee. */
export function fondPour(largeurExport: number): EntreeFond | undefined {
  const candidats = [...FONDS].sort((a, b) => a.largeurCible - b.largeurCible);
  return candidats.find((f) => f.largeurCible >= largeurExport) ?? candidats.at(-1);
}
