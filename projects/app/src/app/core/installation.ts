import { Injectable, signal } from '@angular/core';

/**
 * Evenement Chromium signalant que le site peut etre installe.
 *
 * Il n'est pas dans les types du DOM : il n'est pas standardise, et seuls les
 * navigateurs Chromium l'emettent. On declare donc le strict necessaire.
 */
interface EvenementInstallation extends Event {
  prompt(): Promise<void>;
}

/**
 * Proposition d'installer l'application.
 *
 * Chrome ne montre plus de banniere automatique : l'installation est enfouie
 * dans son menu, ou un benevole n'ira pas chercher ce qu'on ne lui a pas
 * propose. Ce service ecoute le signal du navigateur pour qu'on puisse offrir
 * un bouton au bon moment — et seulement a ce moment.
 *
 * Rien n'est prevu pour iOS, a dessein : Safari n'emet pas cet evenement et ne
 * permet l'installation que par son propre geste de partage. Un bouton y
 * serait un bouton qui ne fait rien, ou une notice a la place d'une action.
 * L'evenement etant propre a Chromium, il n'y a rien a detecter : sur iOS il
 * ne se declenche pas, et aucun bouton n'apparait.
 */
@Injectable({ providedIn: 'root' })
export class Installation {
  /**
   * L'evenement, garde de cote.
   *
   * Le navigateur l'emet UNE fois et attend qu'on l'empeche d'agir pour le
   * rendre reutilisable plus tard. Sans `preventDefault`, il serait consomme
   * sur le champ et le bouton n'aurait plus rien a declencher.
   */
  private evenement?: EvenementInstallation;

  /** Le navigateur declare le site installable, et il ne l'est pas deja. */
  readonly possible = signal(false);

  constructor() {
    // Deja lancee depuis l'ecran d'accueil : il n'y a rien a proposer.
    if (this.dejaInstallee()) return;

    addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.evenement = e as EvenementInstallation;
      this.possible.set(true);
    });

    // L'installation peut aussi passer par le menu du navigateur : la
    // proposition doit disparaitre dans ce cas aussi.
    addEventListener('appinstalled', () => {
      this.evenement = undefined;
      this.possible.set(false);
    });
  }

  /**
   * Ouvre la boite d'installation du navigateur.
   *
   * L'evenement ne sert qu'une fois, quelle que soit la reponse : on le jette
   * et on retire la proposition. Si l'utilisateur a refuse, le navigateur en
   * emettra un nouveau quand il le jugera opportun — c'est lui qui decide, et
   * non nous, ce qui evite de harceler quelqu'un qui a dit non.
   */
  async installer(): Promise<void> {
    const evenement = this.evenement;
    if (!evenement) return;

    this.evenement = undefined;
    this.possible.set(false);
    await evenement.prompt();
  }

  /**
   * L'application tourne-t-elle depuis l'ecran d'accueil ?
   *
   * La sonde est protegee : `matchMedia` manque dans certains environnements,
   * et ce service est construit au demarrage. Une exception ici empecherait
   * l'application entiere de se lancer — pour une simple question de confort.
   * En cas de doute on repond non, et le navigateur tranchera : il n'emettra
   * pas son evenement si le site est deja installe.
   */
  private dejaInstallee(): boolean {
    try {
      return matchMedia('(display-mode: standalone)').matches;
    } catch {
      return false;
    }
  }
}
