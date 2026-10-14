import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import type { GroupeEditable } from 'poster-core';

import { CreneauEditeur } from './creneau-editeur';

/**
 * Hote minimal : le composant attend une BRANCHE de formulaire, pas une valeur.
 */
@Component({
  imports: [CreneauEditeur],
  template: `<ppc-creneau-editeur [champs]="champs" [index]="0" [dernier]="true" />`,
})
class Hote {
  readonly modele = signal<GroupeEditable>({
    id: 'g1',
    date: '2026-09-19',
    heure: '18:00',
    libelleOverride: '',
    domicile: true,
    rencontres: [
      {
        id: 'r1',
        division: 'R2',
        numero: 1,
        adversaireClubId: '',
        adversaireNumero: 0,
        adversaireLibelle: '',
      },
    ],
  });
  readonly champs = form(this.modele);
}

describe('CreneauEditeur', () => {
  it("accorde le rang de l'equipe a la division choisie", async () => {
    // Regression : le passage a un <select> natif avait perdu le gestionnaire
    // qui recalcule le rang. Choisir D4 laissait l'equipe 1, et l'affiche
    // imprimait « St Georges 1 » face a l'adversaire de l'equipe 8.
    const fixture = TestBed.createComponent(Hote);
    await fixture.whenStable();

    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      'select.equipe',
    )!;
    select.value = 'D4';
    select.dispatchEvent(new Event('input'));
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    const rencontre = fixture.componentInstance.modele().rencontres[0]!;
    expect(rencontre.division).toBe('D4');
    expect(rencontre.numero).toBe(8);
  });
});
