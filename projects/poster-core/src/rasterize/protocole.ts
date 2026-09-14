/**
 * Protocole entre le fil principal et le worker de rendu.
 *
 * Type et non implicite : c'est la seule frontiere du moteur ou TypeScript ne
 * verifie rien de lui-meme, les messages traversant `postMessage`. Une union
 * discriminee rend au moins les deux cotes verifiables separement.
 *
 * Le worker ne va RIEN chercher : ni wasm, ni police, ni asset. Tout arrive par
 * le message d'initialisation. C'est ce qui permet au meme code de servir le
 * web, Node et Electron, ou les chemins n'ont rien de commun.
 */

/** Ce que l'appelant veut en retour. */
export type FormeSortie = 'pixels' | 'png';

export type MessageVersWorker =
  | {
      type: 'init';
      /** Octets du module wasm de resvg. */
      wasm: ArrayBuffer;
      /** Tampons de polices, un par face livree. */
      tampons: Uint8Array[];
    }
  | {
      type: 'rendre';
      /**
       * Numero de generation, attribue par le client.
       *
       * L'apercu se redessine a chaque frappe : sans lui, un rendu lance tot et
       * termine tard ecraserait un rendu plus recent. Le client ignore toute
       * reponse dont la generation n'est plus la derniere.
       */
      generation: number;
      svg: string;
      largeur: number;
      sortie: FormeSortie;
    };

export type MessageDepuisWorker =
  | { type: 'pret' }
  | {
      type: 'rendu';
      generation: number;
      sortie: 'pixels';
      pixels: Uint8Array;
      largeur: number;
      hauteur: number;
    }
  | { type: 'rendu'; generation: number; sortie: 'png'; png: Uint8Array }
  | {
      type: 'echec';
      /** Absent si l'echec survient a l'initialisation. */
      generation?: number;
      message: string;
    };
