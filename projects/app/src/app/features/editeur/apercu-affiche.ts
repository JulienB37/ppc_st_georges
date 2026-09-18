import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { nomFichierAffiche } from 'poster-core';

import { Apercu } from '../../core/apercu';
import { Partenaires } from './partenaires';
import { telechargerBlob } from '../../shared/telechargement';
import { DocumentAffiche } from '../../core/document-affiche';

/** Largeur de rendu de l'apercu. Le spike a mesure 14 ms a cette taille. */
const LARGEUR_APERCU = 540;
/** Largeur d'export, celle du repere de l'affiche. */
const LARGEUR_EXPORT = 1080;

/**
 * Apercu de l'affiche, rendu par le meme moteur que l'export.
 *
 * Ce n'est pas une approximation en DOM : les pixels affiches ici sont ceux que
 * resvg produira dans le fichier. C'est la decision centrale du moteur, et elle
 * supprime par construction l'ecart entre ce qu'on voit et ce qu'on publie.
 *
 * Le rendu ne part que si l'affiche est PUBLIABLE. La composition accepte
 * desormais un document incomplet sans lever, mais rasteriser une affiche a
 * trous n'apprendrait rien : le panneau de problemes dit deja ce qui manque,
 * a cote du champ concerne.
 */
@Component({
  selector: 'ppc-apercu-affiche',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Partenaires],
  templateUrl: './apercu-affiche.html',
  styleUrl: './apercu-affiche.scss',
})
export class ApercuAffiche {
  private readonly apercu = inject(Apercu);
  protected readonly doc = inject(DocumentAffiche);

  private readonly toile = viewChild<ElementRef<HTMLCanvasElement>>('toile');

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<string | undefined>(undefined);
  protected readonly avertissements = signal<string[]>([]);
  protected readonly exportEnCours = signal(false);

  /**
   * Redessine a chaque changement du document.
   *
   * Aucun antirebond ici : le client du rasteriseur tient un compteur de
   * generation qui abandonne les rendus depasses, ce qui suffit — et evite
   * d'ajouter une latence fixe a la derniere frappe.
   */
  private readonly redessin = effect(() => {
    const affiche = this.doc.domaine();
    const publiable = this.doc.publiable();
    const toile = this.toile()?.nativeElement;
    if (!toile || !publiable) return;

    this.enCours.set(true);
    void this.apercu
      .apercu(affiche, LARGEUR_APERCU)
      .then((resultat) => {
        // `undefined` : une composition plus recente a pris la main. Il n'y a
        // rien a dessiner, et surtout rien a signaler.
        if (!resultat) return;

        toile.width = resultat.image.largeur;
        toile.height = resultat.image.hauteur;
        const contexte = toile.getContext('2d');
        contexte?.putImageData(
          new ImageData(
            new Uint8ClampedArray(resultat.image.pixels),
            resultat.image.largeur,
            resultat.image.hauteur,
          ),
          0,
          0,
        );
        this.erreur.set(undefined);
        this.avertissements.set(
          resultat.diagnostics.filter((d) => d.niveau === 'alerte').map((d) => d.message),
        );
      })
      .catch((e: unknown) => this.erreur.set(e instanceof Error ? e.message : String(e)))
      .finally(() => this.enCours.set(false));
  });

  /**
   * Telecharge le PNG.
   *
   * Le rendu repasse par le meme moteur, a la largeur d'export : les octets
   * sont ceux de l'apercu, agrandis.
   */
  protected async telecharger(): Promise<void> {
    this.exportEnCours.set(true);
    try {
      const affiche = this.doc.domaine();
      const png = await this.apercu.exporter(affiche, LARGEUR_EXPORT);
      await telechargerBlob(
        new Blob([png as BlobPart], { type: 'image/png' }),
        // Le nom vient de `poster-core`, ou il est teste : journee completee a
        // deux chiffres, championnat, saison.
        nomFichierAffiche(affiche, 'png'),
      );
    } catch (e: unknown) {
      this.erreur.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.exportEnCours.set(false);
    }
  }
}
