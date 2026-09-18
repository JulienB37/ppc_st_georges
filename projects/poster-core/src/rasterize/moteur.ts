import { Resvg, initWasm } from '@resvg/resvg-wasm';

/**
 * Rasterisation, moteur unique de l'aperçu ET de l'export.
 *
 * C'est la decision centrale du moteur de rendu, et c'est la reponse directe au
 * defaut de l'ancien script. Un seul rasteriseur sert les trois usages —
 * apercu, export web, export Electron — si bien que l'apercu n'est pas une
 * approximation du resultat : c'est **le meme rendu**, a plus petite echelle.
 * Toute la classe de bugs « ce n'est pas pareil a l'ecran et dans le fichier »
 * disparait par construction.
 *
 * Les polices n'entrent QUE par `fontBuffers`. resvg ne lit pas les
 * `@font-face`, meme en base64 — l'ancien script en injectait, sans effet — et
 * ses `fontFiles` sont des chemins relatifs au repertoire courant, casses des
 * que le binaire est lance d'ailleurs. Ici rien n'est lu : les octets sont
 * fournis.
 */

/** Une image rasterisee, en RGBA non premultiplie. */
export interface Bitmap {
  pixels: Uint8Array;
  largeur: number;
  hauteur: number;
}

export interface OptionsMoteur {
  /** Octets du module wasm de resvg. La librairie ne les lit jamais elle-meme. */
  wasm: ArrayBuffer | Uint8Array;
  /** Tampons de polices, un par face livree. */
  tampons: readonly Uint8Array[];
}

export interface MoteurRendu {
  /**
   * Rend en pixels bruts, pour l'apercu.
   *
   * Sans encodage PNG : le spike a mesure 14 ms de rendu a 540 px contre 58 ms
   * d'encodage. Encoder puis decoder a chaque frappe couterait donc plus cher
   * que le rendu lui-meme, pour rien — un `ImageData` se pose directement sur
   * un canvas.
   */
  pixels(svg: string, largeurCible: number): Bitmap;
  /** Rend en PNG, pour l'export. Memes octets que l'apercu, par construction. */
  png(svg: string, largeurCible: number): Uint8Array;
}

/**
 * `initWasm` ne peut etre appele qu'une fois par contexte JavaScript : un
 * second appel leve. On memorise donc la promesse, ce qui rend
 * `creerMoteurRendu` appelable plusieurs fois sans precaution cote appelant.
 */
let wasmPret: Promise<void> | undefined;

export async function creerMoteurRendu(options: OptionsMoteur): Promise<MoteurRendu> {
  if (!options.tampons.length) {
    // Echouer ici plutot que de rendre une affiche dont chaque texte serait
    // pose par une police de substitution, en silence.
    throw new Error('Aucune police fournie au moteur de rendu : le texte serait substitue.');
  }

  wasmPret ??= initWasm(options.wasm).then(() => undefined);
  await wasmPret;

  // `fontBuffers` attend des tampons mutables ; on ne les copie pas, resvg ne
  // les modifie pas.
  const fontBuffers = options.tampons as Uint8Array[];

  const rendre = (svg: string, largeurCible: number) => {
    if (!Number.isFinite(largeurCible) || largeurCible <= 0) {
      throw new RangeError(`Largeur de rendu invalide : ${largeurCible}`);
    }
    // Une instance par rendu : `Resvg` porte l'arbre du document, qui change a
    // chaque composition. Ce qui est couteux et partage — le module wasm et les
    // polices — l'est deja par ailleurs.
    return new Resvg(svg, {
      fitTo: { mode: 'width', value: Math.round(largeurCible) },
      font: {
        fontBuffers,
        // Aucune police systeme : le rendu doit etre identique sur le poste du
        // benevole et dans la CI, et un repli systeme serait silencieux.
        loadSystemFonts: false,
      },
    }).render();
  };

  return {
    pixels(svg, largeurCible) {
      const image = rendre(svg, largeurCible);
      return { pixels: image.pixels, largeur: image.width, hauteur: image.height };
    },
    png(svg, largeurCible) {
      return rendre(svg, largeurCible).asPng();
    },
  };
}
