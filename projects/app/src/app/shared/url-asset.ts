/**
 * URL d'un asset, resolue contre la base du document.
 *
 * L'application n'est pas servie a la racine d'un domaine : sur GitHub Pages
 * elle vit sous `/ppc_st_georges/`, et le build y pose un
 * `<base href="/ppc_st_georges/">`.
 *
 * Deux ecritures cassent dans ce contexte, et il faut les eviter toutes deux :
 *
 *   - un chemin ABSOLU, `/assets/x.png`, pointe vers la racine du domaine, ou
 *     il n'y a rien. C'est ce que faisait tout le code, et le site aurait ete
 *     livre sans police, sans logo et sans gabarit ;
 *   - un chemin RELATIF NU passe a `fetch` marche par accident tant que la
 *     base est correcte, mais se lit comme s'il dependait de la route courante.
 *     Un lecteur ne peut pas savoir, sans connaitre la specification, que
 *     `assets/x` depuis `/ppc_st_georges/affiche/adultes` ne donne pas
 *     `/ppc_st_georges/affiche/assets/x`.
 *
 * Cette fonction rend l'intention explicite : la base, et rien que la base.
 * C'est aussi le seul endroit a changer si l'hebergement change.
 *
 * `document.baseURI` reflete le `<base href>` quand il y en a un, et l'URL du
 * document sinon — donc le comportement reste juste en developpement, ou
 * l'application est servie a la racine.
 */
export function urlAsset(chemin: string): string {
  return new URL(chemin, document.baseURI).href;
}
