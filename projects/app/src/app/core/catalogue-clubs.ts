import { Injectable } from '@angular/core';
import { chercherClubs, CLUBS, construireIndex, resoudreClub, type EntreeClub } from 'poster-core';

/** Le club lui-meme : il ne figure pas parmi ses adversaires possibles. */
const CLUB_HOTE = 'pp-st-georgescher';

/**
 * Catalogue des clubs adverses et de leurs logos.
 *
 * L'index de rapprochement est construit une fois : `construireIndex` accepte
 * plusieurs sources, la seconde etant destinee aux clubs que l'utilisateur
 * ajoutera lui-meme (lot 7). Les clubs livres sont donc passes en premier, un
 * ajout ulterieur l'emportant a cle egale.
 *
 * Le classement, la recherche et la resolution viennent de `poster-core`, ou
 * ils sont testes : ce service ne fait que les brancher a l'interface et
 * resoudre les chemins de vignettes, que la librairie ignore par construction.
 */
@Injectable({ providedIn: 'root' })
export class CatalogueClubs {
  private readonly adversaires = Object.values(CLUBS).filter((c) => c.id !== CLUB_HOTE);
  private readonly index = construireIndex(this.adversaires);

  /** Clubs classes par pertinence. Saisie vide : tout le catalogue, par ordre alphabetique. */
  chercher(saisie: string, limite = 8): EntreeClub[] {
    return chercherClubs(saisie, this.index, limite);
  }

  /**
   * Club designe par un libelle saisi a la main.
   *
   * Un rapprochement approximatif n'est JAMAIS applique en silence — c'est la
   * regle du domaine, et la raison pour laquelle `resoudreClub` distingue trois
   * issues. L'interface ne retient donc que la correspondance exacte, et laisse
   * voir qu'un libelle libre n'a pas de logo.
   */
  parLibelle(libelle: string): EntreeClub | undefined {
    const resolution = resoudreClub(libelle, this.index);
    return resolution.type === 'exact' ? resolution.club : undefined;
  }

  parId(clubId: string): EntreeClub | undefined {
    return this.adversaires.find((c) => c.id === clubId);
  }

  /** Chemin de la vignette, servie depuis les assets de l'application. */
  vignette(club: EntreeClub): string {
    return `/assets/clubs/${club.fichier}`;
  }

  /**
   * Blason du club, exclu des adversaires mais affiche dans la saisie.
   *
   * Il y tient le meme role que sur l'affiche : marquer notre camp, en face de
   * celui de l'adversaire. Sans lui, la rangee du formulaire n'est plus le
   * miroir de la rangee imprimee.
   */
  readonly hote = CLUBS[CLUB_HOTE];
}
