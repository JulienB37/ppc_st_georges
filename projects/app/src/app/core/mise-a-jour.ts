import { inject, Injectable, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/**
 * Mise a jour de l'application installee.
 *
 * Un service worker sert l'application depuis le cache : une version publiee
 * n'arrive donc PAS au prochain rechargement, contrairement a un site
 * ordinaire. Sans ce bandeau, un benevole resterait indefiniment sur une
 * ancienne version, et un correctif publie ne l'atteindrait jamais.
 *
 * Le rechargement n'est jamais force : l'utilisateur est peut-etre au milieu
 * d'une saisie, et l'affiche en cours n'est enregistree que lorsqu'elle est
 * complete. On signale, il decide.
 */
@Injectable({ providedIn: 'root' })
export class MiseAJour {
  private readonly sw = inject(SwUpdate, { optional: true });

  /** Une version est prete a prendre la main au prochain rechargement. */
  readonly disponible = signal(false);

  /**
   * Le cache est irrecuperable, l'application tourne hors du service worker.
   *
   * C'est le cas ou un rechargement ordinaire ne repare rien : il faut vider
   * le stockage du site. On le dit, plutot que de laisser l'application se
   * comporter etrangement sans explication.
   */
  readonly cassee = signal(false);

  constructor() {
    if (!this.sw?.isEnabled) return;

    this.sw.versionUpdates.subscribe((evenement) => {
      if (evenement.type === 'VERSION_READY') this.disponible.set(true);
      // Une version installee mais illisible : le cache est corrompu.
      if (evenement.type === 'VERSION_INSTALLATION_FAILED') this.cassee.set(true);
    });

    this.sw.unrecoverable.subscribe(() => this.cassee.set(true));
  }

  /** Prend la nouvelle version. Le rechargement est la seule facon de l'activer. */
  appliquer(): void {
    // `activateUpdate` puis rechargement : l'ordre importe, sans quoi la page
    // se recharge sur l'ancienne version et le bandeau revient.
    void this.sw?.activateUpdate().then(() => location.reload());
  }

  /**
   * Repart de zero : desinscrit les service workers et vide les caches.
   *
   * Les affiches enregistrees vivent dans IndexedDB et ne sont PAS touchees —
   * c'est ce qui rend ce bouton sans danger, et donc proposable a quelqu'un
   * qui ne saura pas ce qu'il repare.
   */
  async reinitialiser(): Promise<void> {
    const inscriptions = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(inscriptions.map((i) => i.unregister()));
    if ('caches' in window) {
      const noms = await caches.keys();
      await Promise.all(noms.map((nom) => caches.delete(nom)));
    }
    location.reload();
  }
}
