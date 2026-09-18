import { Injectable } from '@angular/core';
import {
  SPONSORS,
  SPONSORS_EPINGLES,
  tirerSponsors,
  type EntreeSponsor,
  type SelectionSponsors,
} from 'poster-core';

/**
 * Partenaires proposables a la main, et resolution des trois emplacements.
 *
 * L'affiche porte CINQ partenaires : les deux epingles, qui sont des
 * engagements contractuels et ne s'offrent pas au choix, puis trois
 * emplacements ouverts. Seuls ces trois-la sont exposes ici.
 *
 * Le tirage vit dans `poster-core`, ou il est teste ; ce service ne fait que le
 * brancher a l'interface et resoudre les chemins de vignettes, que la
 * librairie ignore par construction.
 */
@Injectable({ providedIn: 'root' })
export class CataloguePartenaires {
  /**
   * Partenaires que l'utilisateur peut poser sur un emplacement.
   *
   * Les epingles en sont exclus : les proposer laisserait croire qu'on peut les
   * deplacer, et les choisir deux fois retirerait un emplacement au reste du
   * catalogue. Classes par libelle, pour se retrouver dans une liste de vingt.
   */
  readonly proposables: EntreeSponsor[] = Object.values(SPONSORS)
    .filter((s) => s.actif && !(SPONSORS_EPINGLES as readonly string[]).includes(s.id))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));

  /**
   * Ce que les trois emplacements portent reellement, tirage compris.
   *
   * C'est la meme fonction que le rendu appelle : ce que l'utilisateur voit
   * dans la liste est donc ce que l'affiche imprime, y compris pour les
   * emplacements laisses au hasard.
   */
  resoudre(selection: SelectionSponsors): (EntreeSponsor | undefined)[] {
    const tous = tirerSponsors(selection);
    // Les deux premiers sont les epingles, que le tirage place toujours en tete.
    const ouverts = tous.slice(SPONSORS_EPINGLES.length);
    return [0, 1, 2].map((i) => ouverts[i]);
  }

  parId(id: string): EntreeSponsor | undefined {
    return (SPONSORS as Record<string, EntreeSponsor>)[id];
  }

  /** Chemin de la vignette, servie depuis les assets de l'application. */
  vignette(sponsor: EntreeSponsor): string {
    return `assets/sponsors/${sponsor.fichier}`;
  }
}
