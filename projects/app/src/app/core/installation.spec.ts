import { TestBed } from '@angular/core/testing';

import { Installation } from './installation';

/**
 * Le bouton d'installation n'apparait qu'a l'invitation du navigateur.
 *
 * C'est ce qui le rend correct sur toutes les plateformes sans en detecter
 * aucune : Safari n'emettant pas `beforeinstallprompt`, rien ne s'affiche sur
 * iOS, et il n'y a donc pas de bouton qui ne ferait rien.
 *
 * Deux pieges sont couverts ici, tous deux invisibles a l'oeil : l'evenement
 * doit etre NEUTRALISE pour rester utilisable plus tard, et il ne sert qu'UNE
 * fois.
 */
describe('Installation', () => {
  let standalone: boolean;

  beforeEach(() => {
    standalone = false;
    window.matchMedia = ((requete: string) => ({
      matches: requete.includes('standalone') ? standalone : false,
      media: requete,
      // Le service ne s'abonne pas au media : il l'interroge une fois. Les
      // deux methodes existent pour completer le type, sans corps a executer.
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    TestBed.configureTestingModule({});
  });

  /** Reproduit l'evenement du navigateur, et dit s'il a ete neutralise. */
  function emettre(): { neutralise: boolean; invocations: number } {
    const trace = { neutralise: false, invocations: 0 };
    const evenement = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(evenement, {
      prompt: () => {
        trace.invocations++;
        return Promise.resolve();
      },
    });
    evenement.preventDefault = () => {
      trace.neutralise = true;
    };
    dispatchEvent(evenement);
    return trace;
  }

  it('ne propose rien avant que le navigateur ne le signale', () => {
    expect(TestBed.inject(Installation).possible()).toBe(false);
  });

  it('propose l installation quand le navigateur la signale', () => {
    const service = TestBed.inject(Installation);
    const trace = emettre();
    expect(service.possible()).toBe(true);
    // Sans cette neutralisation, l'evenement serait consomme aussitot et le
    // bouton n'aurait plus rien a declencher.
    expect(trace.neutralise).toBe(true);
  });

  it('ouvre la boite du navigateur, une seule fois', async () => {
    const service = TestBed.inject(Installation);
    const trace = emettre();

    await service.installer();
    expect(trace.invocations).toBe(1);
    // La proposition disparait : l'evenement est consomme, et c'est au
    // navigateur d'en emettre un nouveau s'il le juge opportun.
    expect(service.possible()).toBe(false);

    await service.installer();
    expect(trace.invocations).toBe(1);
  });

  it('retire la proposition si l installation passe par le menu du navigateur', () => {
    const service = TestBed.inject(Installation);
    emettre();
    dispatchEvent(new Event('appinstalled'));
    expect(service.possible()).toBe(false);
  });

  it('demarre meme si le navigateur ne sait pas repondre a la sonde', () => {
    // Le service est construit au demarrage : une exception ici empecherait
    // l'application entiere de se lancer, pour une simple question de confort.
    // C'est exactement ce qui est arrive dans l'environnement de test, ou
    // `matchMedia` n'existe pas.
    delete (window as unknown as Record<string, unknown>)['matchMedia'];
    expect(() => TestBed.inject(Installation)).not.toThrow();
    expect(TestBed.inject(Installation).possible()).toBe(false);
  });

  it('ne propose rien quand l application tourne deja installee', () => {
    standalone = true;
    const service = TestBed.inject(Installation);
    emettre();
    expect(service.possible()).toBe(false);
  });
});
