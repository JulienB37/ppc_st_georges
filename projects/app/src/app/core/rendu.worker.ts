/// <reference lib="webworker" />
import { servirRendu, type PorteeWorker } from 'poster-core/rasterize';

/*
 * Point d'entree du worker de rendu.
 *
 * Deux lignes, et c'est voulu : toute la logique vit dans `poster-core`, ou
 * elle est testable dans Node. Ce fichier ne fait que fournir la portee
 * globale du navigateur, la seule chose que la librairie ne peut pas connaitre.
 */
servirRendu(self as unknown as PorteeWorker);
