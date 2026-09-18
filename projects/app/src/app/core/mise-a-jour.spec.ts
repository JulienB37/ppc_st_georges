// Une vraie base, pour que « vos affiches ne sont pas touchees » soit verifie
// sur le meme chemin de code que la persistance reelle.
import 'fake-indexeddb/auto';

import { TestBed } from '@angular/core/testing';

import { MiseAJour } from './mise-a-jour';

/**
 * Le bouton de secours porte une PROMESSE, affichee a l'utilisateur :
 * « Réinitialiser efface son cache ; vos affiches enregistrées ne sont pas
 * touchées. »
 *
 * C'est ce qui rend le bouton proposable a quelqu'un qui ne sait pas ce qu'il
 * repare. Une promesse montree a l'ecran se teste : le nom du fichier
 * telecharge a deja appris a ce depot qu'une affirmation non verifiee finit par
 * etre fausse.
 */
describe('MiseAJour', () => {
  let cachesSupprimes: string[];
  let desinscrits: number;

  beforeEach(() => {
    cachesSupprimes = [];
    desinscrits = 0;

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: () =>
          Promise.resolve([
            {
              unregister: () => {
                desinscrits++;
                return Promise.resolve(true);
              },
            },
          ]),
      },
    });

    (window as unknown as Record<string, unknown>)['caches'] = {
      keys: () => Promise.resolve(['ngsw:1:db:control', 'ngsw:1:coquille']),
      delete: (nom: string) => {
        cachesSupprimes.push(nom);
        return Promise.resolve(true);
      },
    };

    TestBed.configureTestingModule({});
  });

  it('vide les caches et desinscrit le service worker', async () => {
    await TestBed.inject(MiseAJour).reinitialiser();
    expect(desinscrits).toBe(1);
    expect(cachesSupprimes).toEqual(['ngsw:1:db:control', 'ngsw:1:coquille']);
  });

  it('ne touche PAS aux affiches enregistrees', async () => {
    // La base est ouverte avant, et doit contenir la meme chose apres : c'est
    // exactement la phrase affichee a l'utilisateur.
    const base = await new Promise<IDBDatabase>((resoudre, rejeter) => {
      const requete = indexedDB.open('essai-affiches', 1);
      requete.onupgradeneeded = () => requete.result.createObjectStore('affiches');
      requete.onsuccess = () => resoudre(requete.result);
      requete.onerror = () => rejeter(requete.error);
    });
    await new Promise<void>((resoudre, rejeter) => {
      const transaction = base.transaction('affiches', 'readwrite');
      transaction.objectStore('affiches').put({ numero: 12 }, 'j12');
      transaction.oncomplete = () => resoudre();
      transaction.onerror = () => rejeter(transaction.error);
    });

    await TestBed.inject(MiseAJour).reinitialiser();

    const relu = await new Promise<unknown>((resoudre, rejeter) => {
      const requete = base.transaction('affiches', 'readonly').objectStore('affiches').get('j12');
      requete.onsuccess = () => resoudre(requete.result);
      requete.onerror = () => rejeter(requete.error);
    });
    expect(relu).toEqual({ numero: 12 });
    base.close();
  });

  it('demarre sans rien annoncer quand le service worker est absent', () => {
    // En developpement il n'est pas enregistre : le bandeau ne doit pas
    // apparaitre, et le service ne doit pas lever a l'injection.
    const service = TestBed.inject(MiseAJour);
    expect(service.disponible()).toBe(false);
    expect(service.cassee()).toBe(false);
  });
});
