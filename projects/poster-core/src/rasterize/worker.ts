import { creerMoteurRendu, type MoteurRendu } from './moteur';
import type { MessageDepuisWorker, MessageVersWorker } from './protocole';

/**
 * Cote worker du rendu.
 *
 * Volontairement une FONCTION et non un point d'entree autonome : le meme code
 * doit pouvoir etre servi par un `Worker` du navigateur, par un
 * `worker_threads` de Node ou par le renderer Electron, dont les portees
 * globales n'ont rien de commun. Le point d'entree, lui, tient en deux lignes
 * et vit dans l'application.
 *
 * La portee est decrite par le strict minimum utilise, ce qui evite d'imposer
 * la bibliotheque de types `webworker` a toute la librairie.
 */
export interface PorteeWorker {
  /**
   * Deux SURCHARGES et non un parametre optionnel : les signatures du DOM
   * n'acceptent pas `undefined` en seconde position, et une portee reelle ne
   * serait alors pas assignable a cette interface.
   */
  postMessage(message: MessageDepuisWorker): void;
  postMessage(message: MessageDepuisWorker, transfert: ArrayBufferLike[]): void;
  addEventListener(type: 'message', ecouteur: (evenement: { data: unknown }) => void): void;
}

export function servirRendu(portee: PorteeWorker): void {
  let moteur: MoteurRendu | undefined;
  // Les messages de rendu peuvent arriver avant la fin de l'initialisation :
  // on les enchaine derriere elle plutot que de les perdre.
  let initialisation: Promise<void> | undefined;

  const echouer = (message: string, generation?: number) => {
    portee.postMessage({
      type: 'echec',
      message,
      ...(generation === undefined ? {} : { generation }),
    });
  };

  portee.addEventListener('message', (evenement) => {
    const message = evenement.data as MessageVersWorker;

    if (message.type === 'init') {
      initialisation = creerMoteurRendu({ wasm: message.wasm, tampons: message.tampons })
        .then((m) => {
          moteur = m;
          portee.postMessage({ type: 'pret' });
        })
        .catch((erreur: unknown) => {
          echouer(erreur instanceof Error ? erreur.message : String(erreur));
        });
      return;
    }

    const { generation, svg, largeur, sortie } = message;
    void (initialisation ?? Promise.resolve()).then(() => {
      if (!moteur) {
        echouer("Le moteur de rendu n'est pas initialise.", generation);
        return;
      }
      try {
        if (sortie === 'png') {
          const png = moteur.png(svg, largeur);
          // Le tampon est transfere et non copie : un export 2160 px pese
          // plusieurs mega-octets.
          portee.postMessage({ type: 'rendu', generation, sortie: 'png', png }, [png.buffer]);
          return;
        }
        const image = moteur.pixels(svg, largeur);
        portee.postMessage(
          {
            type: 'rendu',
            generation,
            sortie: 'pixels',
            pixels: image.pixels,
            largeur: image.largeur,
            hauteur: image.hauteur,
          },
          // Un apercu 540 px fait deja 1,7 Mo de RGBA, redessine a chaque
          // frappe : le copier serait le poste de cout le plus lourd du cycle.
          [image.pixels.buffer],
        );
      } catch (erreur: unknown) {
        echouer(erreur instanceof Error ? erreur.message : String(erreur), generation);
      }
    });
  });
}
