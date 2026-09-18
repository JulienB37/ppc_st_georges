import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { CataloguePartenaires } from '../../core/catalogue-partenaires';
import { DocumentAffiche } from '../../core/document-affiche';

/**
 * Les trois emplacements de partenaires ouverts au choix.
 *
 * L'affiche en porte cinq : les deux premiers sont epingles par contrat et
 * n'apparaissent pas ici — les montrer sans pouvoir les changer n'aiderait
 * personne, et laisserait croire a un reglage.
 *
 * Chaque emplacement se laisse soit CHOISIR a la main, soit laisser au tirage.
 * Les deux coexistent a dessein : le tirage assure la rotation equitable entre
 * partenaires semaine apres semaine, et le choix manuel permet de rendre un
 * service ponctuel a l'un d'entre eux sans se battre contre la rotation.
 *
 * Ce qui s'affiche dans chaque liste est ce que l'affiche imprime : la
 * resolution passe par la meme fonction que le rendu, tirage compris.
 */
@Component({
  selector: 'ppc-partenaires',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './partenaires.html',
  styleUrl: './partenaires.scss',
})
export class Partenaires {
  protected readonly doc = inject(DocumentAffiche);
  protected readonly catalogue = inject(CataloguePartenaires);

  /**
   * Les trois emplacements, avec ce qu'ils portent et comment.
   *
   * `choisi` distingue le choix manuel du tirage : c'est la seule chose que la
   * liste ne peut pas deviner du sponsor lui-meme, et c'est ce qui decide si
   * une relance le remplacera.
   */
  protected readonly emplacements = computed(() => {
    const selection = this.doc.affiche().sponsors;
    const resolus = this.catalogue.resoudre(selection);
    return selection.emplacements.map((emplacement, i) => ({
      index: i,
      choisi: emplacement.verrouille && emplacement.sponsorId !== null,
      valeur: emplacement.verrouille ? (emplacement.sponsorId ?? '') : '',
      sponsor: resolus[i],
    }));
  });

  /** Nombre d'emplacements encore laisses au tirage : ce que la relance changera. */
  protected readonly auHasard = computed(() => this.emplacements().filter((e) => !e.choisi).length);

  protected choisir(index: number, valeur: string): void {
    this.doc.fixerSponsor(index, valeur || null);
  }
}
