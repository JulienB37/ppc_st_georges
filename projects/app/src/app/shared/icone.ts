import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Les seules icones dont l'editeur a besoin. */
export type NomIcone = 'monter' | 'descendre' | 'supprimer' | 'fermer' | 'ajouter';

const CHEMINS: Record<NomIcone, string> = {
  monter: 'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z',
  descendre: 'M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z',
  supprimer:
    'M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z',
  fermer:
    'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  ajouter: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
};

/**
 * Icone en SVG inline, et non `mat-icon`.
 *
 * `mat-icon` suppose une police d'icones, que Material fait venir de Google
 * Fonts. Or l'application doit fonctionner hors ligne — c'est un usage en
 * salle, avec un wifi mediocre — et sa politique de securite n'autorise aucun
 * CDN. Restaient deux options : heberger la police, soit plus de cent
 * kilo-octets pour cinq glyphes, ou poser les cinq traces. Les voici.
 *
 * `aria-hidden` : ces icones doublent toujours un `matTooltip` et un libelle
 * accessible porte par le bouton, elles n'ont donc rien a annoncer.
 */
@Component({
  selector: 'ppc-icone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path [attr.d]="chemin()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
  `,
})
export class Icone {
  readonly nom = input.required<NomIcone>();
  protected readonly chemin = computed(() => CHEMINS[this.nom()]);
}
