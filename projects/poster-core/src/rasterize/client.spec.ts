import { describe, expect, it } from 'vitest';

import { creerClientRendu, RenduObsolete, type PorteeClient } from './client';
import type { MessageDepuisWorker, MessageVersWorker } from './protocole';

/**
 * Worker factice.
 *
 * La logique du client — compteur de generation, abandon des rendus depasses,
 * acheminement des erreurs — est PURE : elle ne depend ni de resvg ni d'un vrai
 * `Worker`. Un double permet donc de la tester dans Node, la ou un vrai worker
 * demanderait un navigateur et rendrait ces cas quasi intestables.
 */
function porteeFactice() {
  const recus: MessageVersWorker[] = [];
  const ecouteurs: ((evenement: { data: unknown }) => void)[] = [];
  let termine = false;

  const portee: PorteeClient = {
    postMessage: (message) => {
      recus.push(message);
    },
    addEventListener: (_type, ecouteur) => ecouteurs.push(ecouteur),
    terminate: () => {
      termine = true;
    },
  };

  const repondre = (message: MessageDepuisWorker) => {
    for (const e of ecouteurs) e({ data: message });
  };

  const pixels = (generation: number, largeur = 4): MessageDepuisWorker => ({
    type: 'rendu',
    generation,
    sortie: 'pixels',
    pixels: new Uint8Array(largeur * 4),
    largeur,
    hauteur: 1,
  });

  return {
    portee,
    recus,
    repondre,
    pixels,
    estTermine: () => termine,
    /** Ce que ferait un worker pret : le client attend ce message pour livrer. */
    devenirPret: () => repondre({ type: 'pret' }),
  };
}

const OPTIONS = { wasm: new ArrayBuffer(8), tampons: [new Uint8Array([1])] };

describe('creerClientRendu', () => {
  it('initialise le worker et attend son accuse avant de livrer le client', async () => {
    const f = porteeFactice();
    const promesse = creerClientRendu(f.portee, OPTIONS);

    expect(f.recus[0]).toMatchObject({ type: 'init' });
    // La promesse ne doit pas etre deja tenue : le moteur n'est pas pret.
    let tenue = false;
    void promesse.then(() => (tenue = true));
    await Promise.resolve();
    expect(tenue).toBe(false);

    f.devenirPret();
    await expect(promesse).resolves.toBeDefined();
  });

  it('remonte un echec d initialisation plutot que de rendre un client mort', async () => {
    const f = porteeFactice();
    const promesse = creerClientRendu(f.portee, OPTIONS);
    f.repondre({ type: 'echec', message: 'wasm illisible' });
    await expect(promesse).rejects.toThrow(/wasm illisible/);
  });
});

describe('generations', () => {
  async function client() {
    const f = porteeFactice();
    const promesse = creerClientRendu(f.portee, OPTIONS);
    f.devenirPret();
    return { f, client: await promesse };
  }

  it('numerote les rendus et livre celui qui repond', async () => {
    const { f, client: c } = await client();
    const attendu = c.apercu('<svg/>', 540);

    const demande = f.recus.at(-1) as Extract<MessageVersWorker, { type: 'rendre' }>;
    expect(demande).toMatchObject({ type: 'rendre', largeur: 540, sortie: 'pixels' });
    f.repondre(f.pixels(demande.generation));
    await expect(attendu).resolves.toMatchObject({ largeur: 4, hauteur: 1 });
  });

  it('abandonne le rendu precedent quand un plus recent arrive', async () => {
    const { f, client: c } = await client();
    // C'est le cas de l'apercu : une frappe par caractere, et les rendus ne se
    // terminent pas dans l'ordre ou ils partent.
    const premier = c.apercu('<svg>a</svg>', 540);
    const attrape = premier.catch((e: unknown) => e);
    const second = c.apercu('<svg>ab</svg>', 540);

    await expect(attrape).resolves.toBeInstanceOf(RenduObsolete);

    const demande = f.recus.at(-1) as Extract<MessageVersWorker, { type: 'rendre' }>;
    f.repondre(f.pixels(demande.generation, 8));
    await expect(second).resolves.toMatchObject({ largeur: 8 });
  });

  it('jette sans bruit la reponse d une generation depassee', async () => {
    const { f, client: c } = await client();
    const premier = c.apercu('<svg>a</svg>', 540);
    void premier.catch(() => undefined);
    const premiereDemande = f.recus.at(-1) as Extract<MessageVersWorker, { type: 'rendre' }>;

    const second = c.apercu('<svg>ab</svg>', 540);
    const secondeDemande = f.recus.at(-1) as Extract<MessageVersWorker, { type: 'rendre' }>;

    // Le premier rendu termine APRES le second : sans le compteur, il
    // ecraserait l'apercu par un etat depasse.
    f.repondre(f.pixels(premiereDemande.generation, 99));
    f.repondre(f.pixels(secondeDemande.generation, 8));
    await expect(second).resolves.toMatchObject({ largeur: 8 });
  });

  it('acheminie l erreur vers la generation concernee', async () => {
    const { f, client: c } = await client();
    const rendu = c.exporter('<svg/>', 1080);
    const demande = f.recus.at(-1) as Extract<MessageVersWorker, { type: 'rendre' }>;
    f.repondre({ type: 'echec', generation: demande.generation, message: 'SVG invalide' });
    await expect(rendu).rejects.toThrow(/SVG invalide/);
  });

  it('signale une forme de sortie qui ne correspond pas a la demande', async () => {
    const { f, client: c } = await client();
    const rendu = c.exporter('<svg/>', 1080);
    const demande = f.recus.at(-1) as Extract<MessageVersWorker, { type: 'rendre' }>;
    // Un worker qui repondrait des pixels a une demande de PNG : le client doit
    // le dire, pas rendre un tampon de la mauvaise nature.
    f.repondre(f.pixels(demande.generation));
    await expect(rendu).rejects.toThrow(/pixels/);
  });

  it('abandonne le rendu en cours a la fermeture et arrete le worker', async () => {
    const { f, client: c } = await client();
    const rendu = c.apercu('<svg/>', 540);
    const attrape = rendu.catch((e: unknown) => e);
    c.fermer();
    await expect(attrape).resolves.toBeInstanceOf(RenduObsolete);
    expect(f.estTermine()).toBe(true);
  });
});
