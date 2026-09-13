/**
 * Normalisation des noms de clubs.
 *
 * L'ancien script traitait le nom de fichier comme une base de donnees : il
 * normalisait le nom d'equipe saisi a la main, puis tentait d'ouvrir
 * `images/logo_club/<normalise>.png`. En cas d'echec il posait `default.png`
 * et ecrivait une ligne dans la console que personne ne lit.
 *
 * On conserve ici exactement les memes regles de normalisation, pour que les
 * 35 logos existants continuent de se resoudre, mais elles ne servent plus a
 * fabriquer un chemin : elles produisent une cle de rapprochement vers un
 * registre explicite (cf. `resoudre.ts`).
 *
 * Seule difference assumee avec l'ancien algorithme : le separateur devient le
 * tiret plutot que le souligne, pour que les identifiants soient utilisables
 * tels quels dans une URL.
 */

/** Un club ne porte jamais plus de deux chiffres d'equipe. */
const NUMERO_FINAL = /^(.*?)\s+(\d{1,2})$/;

/**
 * Reduit un libelle a sa forme canonique : sans accents, sans ponctuation,
 * en minuscules, mots separes par des tirets.
 *
 * La ponctuation est supprimee sans etre remplacee par un espace, ce qui est
 * le comportement historique : « PP St Georges/Cher » donne
 * `pp-st-georgescher`, et c'est bien ainsi que s'appelle le fichier existant.
 */
export function normaliserNomClub(libelle: string): string {
  return (
    libelle
      .normalize('NFD')
      .toLowerCase()
      .replace(/\p{Diacritic}/gu, '')
      // Le trait d'union separe des mots — « Mont-pres-Chambord » compte pour
      // trois. Les autres signes disparaissent sans laisser de trace, ce qui
      // est le comportement historique dont dependent les fichiers livres.
      .replace(/-/g, ' ')
      .replace(/\p{P}/gu, '')
      .trim()
      .replace(/\s+/g, '-')
  );
}

export interface NomEtNumero {
  /** Le nom du club, sans son numero d'equipe. */
  nom: string;
  /** Le numero d'equipe, ou `null` si le libelle n'en portait pas. */
  numero: number | null;
}

/**
 * Separe « Gien AS TT 1 » en club et numero d'equipe.
 *
 * C'est ce que l'ancien code faisait implicitement, par une regex noyee dans
 * la resolution de fichier. Le rendre explicite permet a l'interface de
 * proposer deux champs distincts — une liste de clubs connus et un numero —
 * et supprime du meme coup toute devinette au moment du rendu.
 */
export function separerNumeroEquipe(libelle: string): NomEtNumero {
  const m = NUMERO_FINAL.exec(libelle.trim());
  if (!m) return { nom: libelle.trim(), numero: null };
  const [, nom = '', numero = ''] = m;
  return { nom: nom.trim(), numero: Number(numero) };
}

/** Identifiant de club deduit d'un libelle saisi : `Gien AS TT 1` -> `gien-as-tt`. */
export function clubIdDepuisLibelle(libelle: string): string {
  return normaliserNomClub(separerNumeroEquipe(libelle).nom);
}

/**
 * Identifiant deduit d'un nom de fichier de logo existant.
 *
 * Les fichiers livres ont ete nommes a la main au fil des saisons, avec des
 * conventions melangees : `aze_tt.png`, `St Avertin.png`, `orleans.png`.
 * On les ramene tous a la meme forme canonique.
 */
export function clubIdDepuisFichier(nomFichier: string): string {
  const sansExtension = nomFichier.replace(/\.[^.]+$/, '');
  return normaliserNomClub(sansExtension.replace(/_/g, ' '));
}

/** Un club sans logo livre : l'affiche posera un monogramme a la place. */
export function monogramme(libelle: string): string {
  const mots = libelle
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .split(/[\s-]+/)
    .filter((mot) => /[A-Za-z0-9]/.test(mot));

  // Un sigle deja court se suffit a lui-meme : « AMO » plutot que « AMT ».
  const premier = mots[0] ?? '';
  if (mots.length === 1) return premier.slice(0, 3).toUpperCase();

  return mots
    .map((mot) => mot[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase();
}
