import { equipeLibreSuivante, type EquipeClub } from '../clubs/equipes';
import { emplacementsVides, graineParDefaut, nouvelId, type Categorie } from '../model/journee';
import type { AfficheEditable, GroupeEditable, RencontreEditable } from './modele';

/**
 * Fabriques et mutations de liste du modele editable.
 *
 * Toutes RENVOIENT une nouvelle valeur au lieu de modifier celle recue. Les
 * Signal Forms lisent le modele depuis un signal : muter le tableau en place
 * ne changerait pas la reference, et rien ne se redessinerait.
 *
 * Elles vivent ici et non dans un composant parce qu'elles sont la seule
 * logique de l'editeur qui merite des tests, et qu'elles n'ont besoin
 * d'aucune dependance Angular pour etre verifiees.
 */

/** Heure par defaut d'une rencontre : celle de la journee type du club. */
const HEURE_PAR_DEFAUT = '18:00';

/**
 * Nouvelle rencontre, pour une equipe du club.
 *
 * L'equipe porte a la fois son rang et sa division : les deux ne peuvent donc
 * pas divergier, et « D2 (3) » — une combinaison qui n'existe pas — n'est plus
 * representable par la saisie.
 */
export function nouvelleRencontre(equipe: EquipeClub): RencontreEditable {
  return {
    id: nouvelId(),
    division: equipe.division,
    numero: equipe.numero,
    adversaireClubId: '',
    adversaireNumero: 0,
    adversaireLibelle: '',
  };
}

/**
 * Nouveau creneau.
 *
 * La date reprend celle du creneau precedent quand il y en a un : une journee
 * se joue sur un ou deux jours, et resaisir la meme date a chaque creneau
 * serait la premiere corvee que cet outil doit supprimer.
 */
export function nouveauGroupe(precedent?: GroupeEditable): GroupeEditable {
  return {
    id: nouvelId(),
    date: precedent?.date ?? '',
    heure: precedent?.heure ?? HEURE_PAR_DEFAUT,
    libelleOverride: '',
    domicile: true,
    rencontres: [],
  };
}

/**
 * Affiche vierge.
 *
 * La categorie est choisie ICI, a la creation, et ne change plus : un document
 * est une affiche adultes OU une affiche jeunes. Les deux championnats
 * n'avancent pas a la meme journee, et rien ne justifie de les saisir ensemble.
 */
export function afficheVide(
  categorie: Categorie,
  numero: number,
  maintenant: string,
): AfficheEditable {
  return {
    id: nouvelId(),
    categorie,
    numero,
    groupes: [nouveauGroupe()],
    sponsors: {
      graine: graineParDefaut(numero, categorie),
      emplacements: emplacementsVides(),
    },
    creeLe: maintenant,
    majLe: maintenant,
  };
}

/** Deplace un element, en bornant la cible au lieu de laisser un index invalide. */
export function deplacer<T>(liste: readonly T[], de: number, vers: number): T[] {
  const copie = [...liste];
  if (de < 0 || de >= copie.length) return copie;
  const cible = Math.min(Math.max(vers, 0), copie.length - 1);
  const [element] = copie.splice(de, 1);
  copie.splice(cible, 0, element!);
  return copie;
}

export function retirer<T>(liste: readonly T[], index: number): T[] {
  return liste.filter((_, i) => i !== index);
}

export function inserer<T>(liste: readonly T[], element: T, index = liste.length): T[] {
  const copie = [...liste];
  copie.splice(Math.min(Math.max(index, 0), copie.length), 0, element);
  return copie;
}

/**
 * Remplace un element par le resultat d'une fonction.
 *
 * Utile aux mutations imbriquees — ajouter une rencontre a un creneau d'une
 * affiche — ou l'ecriture manuelle des trois niveaux de copie est le genre
 * d'endroit ou une reference partagee passe inapercue.
 */
export function remplacer<T>(liste: readonly T[], index: number, calculer: (element: T) => T): T[] {
  return liste.map((element, i) => (i === index ? calculer(element) : element));
}

/**
 * Equipe a proposer au prochain ajout : la premiere que la journee n'engage pas
 * encore, tous creneaux confondus.
 *
 * Ce n'est pas « le suivant du plus grand numero » : les equipes se choisissent
 * dans une table fixe, et une equipe retiree d'un creneau redevient disponible.
 */
export function equipeLibreDe(affiche: AfficheEditable): EquipeClub {
  return equipeLibreSuivante(affiche.groupes.flatMap((g) => g.rencontres.map((r) => r.numero)));
}
