import { Injectable, inject } from '@angular/core';
import { creerMoteurTexte, composerAffiche, emettreSvg, type Diagnostic } from 'poster-core/render';
import {
  creerClientRendu,
  RenduObsolete,
  type Bitmap,
  type ClientRendu,
} from 'poster-core/rasterize';
import type { Affiche } from 'poster-core';

import { AssetsAffiches } from './assets-affiche';

/**
 * Apercu et export de l'affiche, par le rasteriseur.
 *
 * Un seul moteur sert les deux : l'apercu n'est donc pas une approximation du
 * resultat, c'est LE MEME RENDU a plus petite echelle. Toute la classe de bugs
 * « ce n'est pas pareil a l'ecran et dans le fichier » disparait par
 * construction, et c'est la reponse directe au defaut de l'ancien script.
 *
 * Repartition du travail : la COMPOSITION reste sur le fil principal — elle
 * mesure du texte avec fontkit, ce qui est rapide — et seule la RASTERISATION
 * part dans le worker, ou elle ne bloque pas la frappe. Le client tient le
 * compteur de generation qui abandonne les rendus depasses.
 */
export interface ResultatApercu {
  image: Bitmap;
  diagnostics: Diagnostic[];
}

@Injectable({ providedIn: 'root' })
export class Apercu {
  private readonly assets = inject(AssetsAffiches);
  private client?: Promise<ClientRendu>;
  private moteurTexte?: Promise<ReturnType<typeof creerMoteurTexte>>;

  /**
   * Prepare le worker, une fois.
   *
   * Le wasm et les polices lui sont envoyes a l'initialisation : la librairie
   * ne va rien chercher elle-meme, ce qui lui permet de servir le navigateur,
   * Node et Electron sans connaitre leurs chemins.
   */
  private connecter(): Promise<ClientRendu> {
    this.client ??= (async () => {
      const [wasm, faces] = await Promise.all([
        this.assets.chargerWasm(),
        this.assets.chargerPolices(),
      ]);
      const worker = new Worker(new URL('./rendu.worker', import.meta.url), { type: 'module' });
      return creerClientRendu(worker, {
        wasm,
        tampons: faces.map((f) => f.donnees),
      });
    })();
    return this.client;
  }

  private mesure(): Promise<ReturnType<typeof creerMoteurTexte>> {
    this.moteurTexte ??= this.assets.chargerPolices().then(creerMoteurTexte);
    return this.moteurTexte;
  }

  /**
   * Rend l'affiche en pixels, pour l'apercu.
   *
   * Rend `undefined` quand une composition plus recente a remplace celle-ci :
   * ce n'est pas une erreur, c'est le compteur de generation qui fait son
   * travail, et l'appelant n'a rien a afficher.
   */
  async apercu(affiche: Affiche, largeur: number): Promise<ResultatApercu | undefined> {
    const { svg, diagnostics } = await this.composer(affiche);
    const client = await this.connecter();
    try {
      return { image: await client.apercu(svg, largeur), diagnostics };
    } catch (erreur) {
      if (erreur instanceof RenduObsolete) return undefined;
      throw erreur;
    }
  }

  /** Rend l'affiche en PNG, pour l'export. Memes octets que l'apercu. */
  async exporter(affiche: Affiche, largeur: number): Promise<Uint8Array> {
    const { svg } = await this.composer(affiche);
    return (await this.connecter()).exporter(svg, largeur);
  }

  /** Le SVG de l'affiche, utile a l'export vectoriel. */
  async svg(affiche: Affiche): Promise<string> {
    return (await this.composer(affiche)).svg;
  }

  private async composer(affiche: Affiche): Promise<{ svg: string; diagnostics: Diagnostic[] }> {
    const [moteur, assets] = await Promise.all([this.mesure(), this.assets.pourAffiche(affiche)]);
    const { scene, diagnostics } = composerAffiche(affiche, assets, moteur);
    return { svg: emettreSvg(scene), diagnostics };
  }
}
