// Informations legales du site. A COMPLETER avant la mise en ligne (voir README, section "Mise en ligne").
// Un particulier qui edite un site sans but professionnel peut rester anonyme : il suffit d'indiquer l'hebergeur,
// a qui il communique son identite (loi pour la confiance dans l'economie numerique, art. 6 III 2).
export const LEGAL = {
  siteName: 'BetterMove',
  /** Adresse publique du site, ex. https://bettermove.fr */
  siteUrl: import.meta.env.VITE_SITE_URL ?? '',
  /** Editeur : laisser vide pour rester anonyme (particulier non professionnel) */
  editor: import.meta.env.VITE_LEGAL_EDITOR ?? '',
  /** Hebergeur du serveur : nom, adresse, telephone (obligatoire) */
  hostName: import.meta.env.VITE_LEGAL_HOST_NAME ?? '',
  hostAddress: import.meta.env.VITE_LEGAL_HOST_ADDRESS ?? '',
  hostPhone: import.meta.env.VITE_LEGAL_HOST_PHONE ?? '',
  /** Code source public du site (obligatoire : licence GPL-3.0, voir la page Licences) */
  sourceUrl: import.meta.env.VITE_SOURCE_URL ?? '',
  /** Date de derniere mise a jour des documents */
  updated: '5 novembre 2026',
};

/** Valeur a renseigner : affichee clairement tant qu'elle manque */
export const orTodo = (v: string) => v || '[à compléter avant la mise en ligne]';
