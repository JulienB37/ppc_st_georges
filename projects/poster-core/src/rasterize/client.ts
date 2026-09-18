import type { Bitmap } from './moteur';
import type { MessageDepuisWorker, MessageVersWorker } from './protocole';

/**
 * Cote fil principal du rendu.
 *
 * Il tient le compteur de generation. L'apercu se redessine a chaque frappe et
 * les rendus ne se terminent pas dans l'ordre ou ils partent : sans ce
 * compteur, un rendu lance tot et termine tard ecraserait un rendu plus
 * recent, et l'apercu papilloterait en affichant un etat depasse.
 *
 * La regle est donc : une seule generation est vivante a la fois. Un nouvel
 * appel rend la precedente obsolete, et sa promesse est rejetee par
 * `RenduObsolete` — que l'appelant peut ignorer sans risque.
 */

/**
 * Portee minimale attendue d'un worker, cote client.
 *
 * `postMessage` n'y prend qu'un argument : le client ne transfere rien — c'est
 * le worker qui renvoie les gros tampons, et lui seul a besoin d'une liste de
 * transfert. Un parametre optionnel rendrait d'ailleurs un `Worker` du
 * navigateur non assignable, ses surcharges n'acceptant pas `undefined`.
 */
export interface PorteeClient {
  postMessage(message: MessageVersWorker): void;
  addEventListener(type: 'message', ecouteur: (evenement: { data: unknown }) => void): void;
  terminate?(): void;
}

/** Rejet d'un rendu qu'un rendu plus recent a remplace. Sans gravite. */
export class RenduObsolete extends Error {
  constructor(generation: number) {
    super(`Rendu ${generation} abandonne : une composition plus recente l'a remplace.`);
    this.name = 'RenduObsolete';
  }
}

export interface ClientRendu {
  /** Rend en pixels, pour l'apercu. */
  apercu(svg: string, largeur: number): Promise<Bitmap>;
  /** Rend en PNG, pour l'export. */
  exporter(svg: string, largeur: number): Promise<Uint8Array>;
  fermer(): void;
}

interface Attente {
  generation: number;
  resoudre: (valeur: never) => void;
  rejeter: (erreur: Error) => void;
  // Stocke non type : le discriminant `sortie` du message le retablit.
  livrer: (message: Extract<MessageDepuisWorker, { type: 'rendu' }>) => void;
}

export interface OptionsClient {
  /** Octets du module wasm de resvg, charges par l'application. */
  wasm: ArrayBuffer;
  /** Tampons de polices, un par face livree. */
  tampons: Uint8Array[];
}

/**
 * Cree le client et attend que le worker soit pret.
 *
 * L'initialisation est attendue ici, une fois, plutot que verifiee a chaque
 * rendu : l'appelant obtient un client deja utilisable, ou une erreur.
 */
export function creerClientRendu(
  portee: PorteeClient,
  options: OptionsClient,
): Promise<ClientRendu> {
  let generation = 0;
  let attente: Attente | undefined;
  let pret: (() => void) | undefined;
  let echecInitial: ((erreur: Error) => void) | undefined;

  portee.addEventListener('message', (evenement) => {
    const message = evenement.data as MessageDepuisWorker;

    if (message.type === 'pret') {
      pret?.();
      return;
    }

    if (message.type === 'echec') {
      if (message.generation === undefined) {
        echecInitial?.(new Error(message.message));
        return;
      }
      if (attente?.generation === message.generation) {
        attente.rejeter(new Error(message.message));
        attente = undefined;
      }
      return;
    }

    // Une reponse d'une generation depassee est jetee sans bruit : c'est
    // exactement ce que le compteur sert a faire.
    if (attente?.generation !== message.generation) return;
    attente.livrer(message);
    attente = undefined;
  });

  const promesse = new Promise<void>((resoudre, rejeter) => {
    pret = resoudre;
    echecInitial = rejeter;
  });

  // Le wasm et les polices sont transferes : l'application n'en a plus besoin.
  portee.postMessage({ type: 'init', wasm: options.wasm, tampons: options.tampons });

  function demander<T>(
    svg: string,
    largeur: number,
    sortie: 'pixels' | 'png',
    extraire: (message: Extract<MessageDepuisWorker, { type: 'rendu' }>) => T | undefined,
  ): Promise<T> {
    attente?.rejeter(new RenduObsolete(attente.generation));
    const mienne = ++generation;

    return new Promise<T>((resoudre, rejeter) => {
      attente = {
        generation: mienne,
        resoudre: resoudre as unknown as (valeur: never) => void,
        rejeter,
        livrer: (message) => {
          const valeur = extraire(message);
          if (valeur === undefined) {
            rejeter(
              new Error(`Le worker a renvoye « ${message.sortie} » au lieu de « ${sortie} ».`),
            );
            return;
          }
          resoudre(valeur);
        },
      };
      portee.postMessage({ type: 'rendre', generation: mienne, svg, largeur, sortie });
    });
  }

  return promesse.then(() => ({
    apercu: (svg, largeur) =>
      demander<Bitmap>(svg, largeur, 'pixels', (m) =>
        m.sortie === 'pixels'
          ? { pixels: m.pixels, largeur: m.largeur, hauteur: m.hauteur }
          : undefined,
      ),
    exporter: (svg, largeur) =>
      demander<Uint8Array>(svg, largeur, 'png', (m) => (m.sortie === 'png' ? m.png : undefined)),
    fermer: () => {
      attente?.rejeter(new RenduObsolete(attente.generation));
      attente = undefined;
      portee.terminate?.();
    },
  }));
}
