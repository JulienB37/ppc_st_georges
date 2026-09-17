import { quantiemeMois } from './ordinal';

/** Date et heure locales d'un creneau, sans fuseau : `2026-09-19T18:00`. */
const CRENEAU_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export interface CreneauParts {
  annee: number;
  mois: number; // 1-12
  jour: number; // 1-31
  heures: number; // 0-23
  minutes: number; // 0-59
}

/**
 * Decale un creneau d'un nombre de jours, en conservant l'heure.
 *
 * L'arithmetique passe par `Date.UTC`, et c'est le seul endroit du projet ou
 * une `Date` intervient sur un creneau. C'est licite ici parce que les
 * composants sont poses A LA MAIN en UTC : aucun fuseau local n'est consulte,
 * aucune heure d'ete ne s'applique, et le calcul est donc identique partout.
 * Ce que le projet interdit, c'est `new Date(chaine)`, dont l'interpretation
 * — locale ou UTC — depend de la forme de la chaine.
 *
 * L'heure est reportee telle quelle, volontairement : une journee decalee d'une
 * semaine se joue a la meme heure, y compris de part et d'autre d'un changement
 * d'heure.
 */
export function decalerCreneau(debutIso: string, jours: number): string {
  const { annee, mois, jour, heures, minutes } = parseCreneau(debutIso);
  const t = Date.UTC(annee, mois - 1, jour) + jours * 86_400_000;
  const d = new Date(t);
  const deuxChiffres = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${deuxChiffres(d.getUTCMonth() + 1)}-${deuxChiffres(d.getUTCDate())}` +
    `T${deuxChiffres(heures)}:${deuxChiffres(minutes)}`
  );
}

/**
 * Vrai si la chaine est un creneau local complet et coherent.
 *
 * Utile partout ou un creneau peut etre INCOMPLET sans que ce soit une erreur :
 * un formulaire en cours de saisie, notamment, ou la date est vide avant que
 * l'utilisateur ne la tape. Le predicat evite d'avoir a intercepter une
 * exception pour poser une question.
 */
export function creneauValide(iso: string): boolean {
  try {
    parseCreneau(iso);
    return true;
  } catch {
    return false;
  }
}

/**
 * Decoupe un creneau local en composants.
 *
 * On n'utilise pas `new Date(iso)` : selon la forme de la chaine, le moteur
 * l'interprete tantot en local tantot en UTC, ce qui ferait dependre le libelle
 * imprime sur l'affiche du fuseau de la machine. Une journee samedi 18h00 doit
 * s'ecrire « Samedi 19 septembre a 18h00 » partout, y compris dans la CI.
 */
export function parseCreneau(iso: string): CreneauParts {
  const m = CRENEAU_LOCAL.exec(iso);
  if (!m) {
    throw new RangeError(`Creneau invalide : "${iso}" (attendu AAAA-MM-JJThh:mm)`);
  }
  // Valeurs par defaut pour satisfaire `noUncheckedIndexedAccess` : la regex
  // ayant matche, les cinq groupes sont necessairement presents.
  const [, a = '', mo = '', j = '', h = '', mi = ''] = m;
  const parts: CreneauParts = {
    annee: Number(a),
    mois: Number(mo),
    jour: Number(j),
    heures: Number(h),
    minutes: Number(mi),
  };
  if (parts.mois < 1 || parts.mois > 12) {
    throw new RangeError(`Mois invalide dans "${iso}"`);
  }
  if (parts.heures > 23 || parts.minutes > 59) {
    throw new RangeError(`Heure invalide dans "${iso}"`);
  }
  // Rejette le 31 avril ou le 30 fevrier, qu'un simple controle de bornes laisse passer.
  const probe = new Date(Date.UTC(parts.annee, parts.mois - 1, parts.jour));
  if (probe.getUTCMonth() !== parts.mois - 1 || probe.getUTCDate() !== parts.jour) {
    throw new RangeError(`Date inexistante : "${iso}"`);
  }
  return parts;
}

/** `Date` en UTC pur, uniquement pour interroger `Intl` sans derive de fuseau. */
function asUtc({ annee, mois, jour }: CreneauParts): Date {
  return new Date(Date.UTC(annee, mois - 1, jour));
}

function capitaliser(mot: string): string {
  return mot.charAt(0).toLocaleUpperCase('fr-FR') + mot.slice(1);
}

/** « Samedi », « Dimanche »... */
export function jourSemaine(parts: CreneauParts): string {
  const brut = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' }).format(
    asUtc(parts),
  );
  return capitaliser(brut);
}

/** « septembre », « mai »... En francais les mois restent en minuscules. */
export function nomMois(parts: CreneauParts): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(asUtc(parts));
}

/**
 * « 18h00 », « 9h30 ». Pas de zero initial sur les heures, toujours deux
 * chiffres pour les minutes : c'est l'usage francais et celui deja en place
 * dans les anciennes affiches.
 */
export function formatHeure({ heures, minutes }: CreneauParts): string {
  return `${heures}h${String(minutes).padStart(2, '0')}`;
}

/**
 * Libelle complet d'un creneau : « Samedi 19 septembre a 18h00 ».
 *
 * Corrige au passage les fautes des anciennes affiches, qui affichaient
 * « Samedi 09 Mai » (zero initial parasite, mois capitalise a tort).
 */
export function formatCreneau(iso: string): string {
  const parts = parseCreneau(iso);
  return `${jourSemaine(parts)} ${quantiemeMois(parts.jour)} ${nomMois(parts)} à ${formatHeure(parts)}`;
}

/**
 * Saison sportive contenant ce creneau, au format « 2025-2026 ».
 *
 * La saison FFTT court de septembre a aout : une journee de mai 2026 appartient
 * a la saison 2025-2026. Deduire la saison de la date evite a l'utilisateur un
 * ecran de configuration de plus.
 */
export function saisonDe(iso: string): string {
  const { annee, mois } = parseCreneau(iso);
  const debut = mois >= 9 ? annee : annee - 1;
  return `${debut}-${debut + 1}`;
}
