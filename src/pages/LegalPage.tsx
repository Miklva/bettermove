// Pages legales : mentions legales, confidentialite (RGPD), conditions d'utilisation, licences et code source.
import { useState, type ReactNode } from 'react';
import { useRouteSync } from '../router';
import { LEGAL, orTodo } from '../legal/config';

type Doc = 'mentions' | 'confidentialite' | 'conditions' | 'licences';
const DOCS: { id: Doc; label: string; slug: string }[] = [
  { id: 'mentions', label: 'Mentions légales', slug: 'mentions-legales' },
  { id: 'confidentialite', label: 'Confidentialité', slug: 'confidentialite' },
  { id: 'conditions', label: 'Conditions d’utilisation', slug: 'conditions' },
  { id: 'licences', label: 'Licences et code source', slug: 'licences' },
];

export function LegalPage({ onSupport }: { onSupport: () => void }) {
  const [doc, setDoc] = useState<Doc>('mentions');
  useRouteSync<Doc>(
    1,
    doc,
    setDoc,
    (d) => DOCS.find((x) => x.id === d)!.slug,
    (s) => DOCS.find((x) => x.slug === s)?.id,
  );
  const support = (
    <button className="link-like" onClick={onSupport}>
      formulaire de support
    </button>
  );
  return (
    <div className="legal">
      <div className="chips legal-tabs">
        {DOCS.map((d) => (
          <button key={d.id} className={`chip ${doc === d.id ? 'selected' : ''}`} onClick={() => setDoc(d.id)}>
            {d.label}
          </button>
        ))}
      </div>
      <article className="card legal-doc">
        {doc === 'mentions' && <Mentions support={support} />}
        {doc === 'confidentialite' && <Privacy support={support} />}
        {doc === 'conditions' && <Terms support={support} />}
        {doc === 'licences' && <Licences />}
        <p className="muted small">Dernière mise à jour : {LEGAL.updated}.</p>
      </article>
    </div>
  );
}

function Mentions({ support }: { support: ReactNode }) {
  return (
    <>
      <h1>Mentions légales</h1>
      <h2>Éditeur</h2>
      {LEGAL.editor ? (
        <p>{LEGAL.editor}</p>
      ) : (
        <p>
          {LEGAL.siteName} est un projet indépendant, non commercial, édité par un particulier. Conformément à l’article 6 III 2 de
          la loi pour la confiance dans l’économie numérique, son identité a été communiquée à l’hébergeur ci-dessous.
        </p>
      )}
      <p>Contact : {support} (accessible depuis le menu ❓ › Contacter le support).</p>
      <h2>Hébergeur</h2>
      <p>
        {orTodo(LEGAL.hostName)}
        <br />
        {orTodo(LEGAL.hostAddress)}
        <br />
        {orTodo(LEGAL.hostPhone)}
      </p>
      <h2>Propriété intellectuelle</h2>
      <p>
        Le code de {LEGAL.siteName} est un logiciel libre publié sous licence GNU GPL version 3 ou ultérieure (voir l’onglet
        « Licences et code source »). Les noms Lichess et chess.com sont des marques de leurs propriétaires respectifs :
        {' '}{LEGAL.siteName} n’est ni affilié, ni approuvé, ni sponsorisé par eux. Ils sont cités uniquement pour permettre
        d’importer tes propres parties.
      </p>
    </>
  );
}

function Privacy({ support }: { support: ReactNode }) {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p>
        {LEGAL.siteName} collecte le strict nécessaire pour faire fonctionner le site. Aucune publicité, aucun outil de mesure
        d’audience, aucun traceur tiers, aucune revente de données.
      </p>

      <h2>Sans compte</h2>
      <p>
        Ta progression (niveau, Elo, parties, succès, réglages, notes) est enregistrée uniquement dans ton navigateur (stockage
        local). Elle ne quitte pas ton appareil. Tu peux l’effacer à tout moment : 👤 Compte › Effacer les données de ce navigateur.
      </p>

      <h2>Avec un compte</h2>
      <ul>
        <li>
          <b>Compte</b> : pseudo, mot de passe chiffré (jamais stocké en clair), date d’inscription, date de dernière activité
          (affichée aux autres joueurs : « en ligne », « vu il y a… »).
        </li>
        <li>
          <b>Adresse e-mail (facultative)</b> : uniquement pour confirmer qu’elle t’appartient et t’envoyer un lien en cas de mot
          de passe oublié. Jamais affichée aux autres joueurs, jamais utilisée pour de la publicité. Tu peux la changer ou la
          retirer à tout moment (👤 Compte › Mon adresse e-mail). Les liens envoyés expirent après 1 heure (mot de passe) ou 48
          heures (confirmation).
        </li>
        <li>
          <b>Progression synchronisée</b> : les données de l’app (Elo, XP, parties, succès, réglages, répertoire, notes du suivi,
          inventaire de la boutique) pour les retrouver sur tous tes appareils.
        </li>
        <li>
          <b>Profil public</b> : pseudo, photo si tu en ajoutes une, niveau, statistiques, succès, galerie des bots battus, Elo et
          classements. Ces informations sont visibles par les autres joueurs.
        </li>
        <li>
          <b>Communauté</b> : messages du salon (publics), messages privés, demandes d’amis, joueurs mis en sourdine, défis,
          parties en ligne et leur chat, résultats du problème du jour et du Puzzle Rush (classements publics).
        </li>
        <li>
          <b>Parrainage (événements)</b> : qui a invité qui. Ton lien d’invitation contient ton pseudo ; tes filleuls et le
          classement des parrains sont visibles dans l’onglet Événements.
        </li>
      </ul>

      <h2>Support</h2>
      <p>
        Quand tu écris au support : ton nom ou pseudo, ton e-mail si tu le donnes (uniquement pour te répondre), ton message et, si
        tu laisses la case cochée, des informations techniques (page, navigateur, taille d’écran, pseudo). Conservé 2 ans maximum.
      </p>

      <h2>Sécurité et journaux techniques</h2>
      <p>
        L’adresse IP sert, en mémoire et quelques minutes, à limiter les abus (tentatives de connexion, spam). Le serveur peut tenir
        des journaux techniques (adresse IP, page demandée, date) pour la sécurité, conservés 12 mois au maximum comme l’impose la
        loi. Les mots de passe sont hachés (bcrypt), la session est un cookie protégé (httpOnly), et les échanges passent en HTTPS.
      </p>

      <h2>Cookies et stockage local</h2>
      <p>
        Un seul cookie : <code>bm_session</code>, qui te garde connecté (90 jours). Le stockage local du navigateur garde ta
        progression et tes réglages. Les deux sont strictement nécessaires au fonctionnement du site : ils ne demandent pas de
        consentement et ne servent jamais à te suivre.
      </p>

      <h2>Mesure d’audience</h2>
      <p>
        Pour savoir combien de personnes visitent BetterMove, le serveur compte les visiteurs uniques de chaque jour, sans cookie et
        sans rien enregistrer sur ton appareil. Il calcule une empreinte à partir de ton adresse IP et de ton navigateur, mélangée à
        une valeur aléatoire qui change chaque jour et n’est pas conservée : ton adresse IP n’est jamais enregistrée, et on ne peut
        pas te suivre d’un jour à l’autre. Seuls des chiffres globaux sont affichés (visiteurs par jour, connectés ou non). Les
        données sont effacées au bout de 13 mois.
      </p>

      <h2>Services tiers</h2>
      <p>
        L’import de parties contacte directement Lichess (lichess.org) ou chess.com (api.chess.com) depuis ton navigateur, avec le
        pseudo que tu saisis. Leurs propres politiques de confidentialité s’appliquent. Rien d’autre n’est chargé depuis un site
        tiers (ni polices, ni scripts, ni statistiques).
      </p>

      <h2>Bases légales</h2>
      <ul>
        <li>Exécution du service que tu demandes : compte, synchronisation, jeu en ligne, messagerie.</li>
        <li>Intérêt légitime : sécurité, lutte contre les abus, modération de la communauté.</li>
        <li>Consentement : adresse e-mail du compte, photo de profil, e-mail laissé au support, informations techniques jointes.</li>
      </ul>

      <h2>Destinataires et hébergement</h2>
      <p>
        Les données ne sont transmises à personne. Seul l’hébergeur du serveur ({orTodo(LEGAL.hostName)}) y a accès techniquement,
        pour le compte de {LEGAL.siteName}.
      </p>

      <h2>Durées de conservation</h2>
      <ul>
        <li>Compte et données associées : tant que le compte existe. Un compte inactif depuis 3 ans est supprimé.</li>
        <li>Demandes au support : 2 ans.</li>
        <li>Journaux techniques : 12 mois maximum.</li>
      </ul>

      <h2>Tes droits</h2>
      <p>
        Tu peux accéder à tes données, les corriger, les récupérer, t’opposer à un traitement ou les faire effacer. Directement dans
        l’app (👤 Compte) : <b>Télécharger mes données</b> (fichier complet) et <b>Supprimer mon compte</b> (effacement immédiat et
        définitif). Pour toute autre demande : {support}. Tu peux aussi saisir la CNIL (www.cnil.fr).
      </p>

      <h2>Mineurs</h2>
      <p>
        Si tu as moins de 15 ans, demande l’accord d’un parent avant de créer un compte. Le salon et les messages privés sont
        modérés (filtre de mots, sourdine, suppression des messages par les modérateurs).
      </p>
    </>
  );
}

function Terms({ support }: { support: ReactNode }) {
  return (
    <>
      <h1>Conditions d’utilisation</h1>
      <h2>Le service</h2>
      <p>
        {LEGAL.siteName} est gratuit, sans publicité ni achat. Il est fourni tel quel, sans garantie de disponibilité : il peut
        évoluer, être interrompu ou s’arrêter. Pense à télécharger tes données si tu y tiens.
      </p>
      <h2>Ton compte</h2>
      <p>
        Un compte par personne. Tu es responsable de ton mot de passe. Ton pseudo ne doit pas être injurieux ni usurper
        l’identité de quelqu’un.
      </p>
      <h2>Respect des autres joueurs</h2>
      <ul>
        <li>Pas d’insultes, de harcèlement, de propos haineux, de contenus choquants ni de spam.</li>
        <li>Pas de données personnelles d’autrui (adresse, téléphone…) dans les messages.</li>
        <li>Pas d’aide extérieure (moteur, autre personne) pendant une partie en ligne classée.</li>
      </ul>
      <p>
        En cas de manquement, les messages peuvent être supprimés et le compte suspendu ou supprimé. Pour signaler un problème :
        {' '}{support}.
      </p>
      <h2>Pièces et objets de la boutique</h2>
      <p>
        Les pièces 🪙, skins, sons et émojis sont des éléments de jeu virtuels, gagnés en jouant. Ils n’ont aucune valeur
        monétaire, ne s’achètent pas avec de l’argent réel et ne sont ni échangeables ni remboursables en argent.
      </p>
      <h2>Ce que tu publies</h2>
      <p>
        Tu restes propriétaire de tes messages et de ta photo. Tu autorises {LEGAL.siteName} à les afficher aux autres joueurs le
        temps qu’ils sont en ligne. Tu peux les supprimer en supprimant ton compte.
      </p>
      <h2>Droit applicable</h2>
      <p>Ces conditions relèvent du droit français.</p>
    </>
  );
}

const THIRD_PARTY: { name: string; use: string; license: string; url: string }[] = [
  { name: 'chessground', use: 'Plateau d’échecs interactif et ses styles', license: 'GPL-3.0-or-later', url: 'https://github.com/lichess-org/chessground' },
  { name: 'Pièces « cburnett »', use: 'Dessin des pièces (et masques des skins)', license: 'GPL-2.0-or-later, BSD ou GFDL au choix (Colin M.L. Burnett)', url: 'https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces' },
  { name: 'Stockfish 19 (portage WebAssembly stockfish.js, version lite)', use: 'Moteur d’analyse et des bots', license: 'GPL-3.0', url: 'https://github.com/nmrugg/stockfish.js' },
  { name: 'chess.js', use: 'Règles du jeu', license: 'BSD-2-Clause', url: 'https://github.com/jhlywa/chess.js' },
  { name: 'React', use: 'Interface', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'Base de problèmes Lichess', use: 'Problèmes et Puzzle Rush', license: 'CC0 (domaine public)', url: 'https://database.lichess.org/#puzzles' },
  { name: 'lichess-org/chess-openings', use: 'Noms des ouvertures', license: 'CC0 (domaine public)', url: 'https://github.com/lichess-org/chess-openings' },
  { name: 'Express, pg, bcryptjs, jsonwebtoken, nodemailer, cookie-parser', use: 'Serveur', license: 'MIT', url: 'https://www.npmjs.com/' },
];

function Licences() {
  return (
    <>
      <h1>Licences et code source</h1>
      <p>
        {LEGAL.siteName} est un logiciel libre : tu peux l’utiliser, l’étudier, le modifier et le redistribuer selon les termes de
        la licence GNU General Public License version 3 ou ultérieure (GPL-3.0-or-later), sans aucune garantie. Ce choix découle des
        composants libres sur lesquels il s’appuie (plateau chessground, moteur Stockfish).
      </p>
      <p>
        <b>Code source complet :</b>{' '}
        {LEGAL.sourceUrl ? (
          <a href={LEGAL.sourceUrl} target="_blank" rel="noopener noreferrer">
            {LEGAL.sourceUrl}
          </a>
        ) : (
          orTodo('')
        )}
      </p>
      <p>
        Texte de la licence : <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer">gnu.org/licenses/gpl-3.0</a>
      </p>
      <h2>Composants tiers</h2>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th>Composant</th>
              <th>Utilisation</th>
              <th>Licence</th>
            </tr>
          </thead>
          <tbody>
            {THIRD_PARTY.map((t) => (
              <tr key={t.name}>
                <td>
                  <a href={t.url} target="_blank" rel="noopener noreferrer">
                    {t.name}
                  </a>
                </td>
                <td>{t.use}</td>
                <td>{t.license}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Les bots, leurs portraits et leurs dialogues, les cours, les skins, les sons (synthétisés dans le navigateur) et les émojis
        sont des créations originales de {LEGAL.siteName}. Lichess et chess.com sont des marques de leurs propriétaires : aucune
        affiliation.
      </p>
    </>
  );
}
