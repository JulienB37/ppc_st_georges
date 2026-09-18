import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it("s'affiche avec le nom du club", async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const rendu = fixture.nativeElement as HTMLElement;
    expect(rendu.textContent).toContain('PPC St Georges/Cher');
  });

  it('expose un point de montage pour les routes', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });
});
