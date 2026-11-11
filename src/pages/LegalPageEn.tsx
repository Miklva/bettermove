// Pages legales en anglais (affichees pour toutes les langues autres que le francais).
// La version francaise fait foi : un bandeau le rappelle en haut de chaque document.
import type { ReactNode } from 'react';
import { LEGAL } from '../legal/config';

const todo = (v: string) => v || '[to be completed]';

export function MentionsEn({ support }: { support: ReactNode }) {
  return (
    <>
      <h1>Legal notice</h1>
      <h2>Publisher</h2>
      {LEGAL.editor ? (
        <p>{LEGAL.editor}</p>
      ) : (
        <p>
          {LEGAL.siteName} is an independent, non-commercial project published by a private individual. In accordance with article 6
          III 2 of the French law on confidence in the digital economy (LCEN), their identity has been provided to the host below.
        </p>
      )}
      <p>Contact: {support} (available from the ❓ menu › Contact support).</p>
      <h2>Host</h2>
      <p>
        {todo(LEGAL.hostName)}
        <br />
        {todo(LEGAL.hostAddress)}
        <br />
        {todo(LEGAL.hostPhone)}
      </p>
      <h2>Intellectual property</h2>
      <p>
        The code of {LEGAL.siteName} is free software released under the GNU GPL version 3 or later (see the “Licenses and source
        code” tab). Lichess and chess.com are trademarks of their respective owners: {LEGAL.siteName} is not affiliated with,
        endorsed or sponsored by them. They are mentioned only so you can import your own games.
      </p>
    </>
  );
}

export function PrivacyEn({ support }: { support: ReactNode }) {
  return (
    <>
      <h1>Privacy policy</h1>
      <p>
        {LEGAL.siteName} collects only what is strictly needed to run the site. No ads, no third-party analytics, no third-party
        trackers, no selling of data.
      </p>

      <h2>Without an account</h2>
      <p>
        Your progress (level, rating, games, achievements, settings, notes) is stored only in your browser (local storage). It never
        leaves your device. You can erase it at any time: 👤 Account › Clear this browser’s data.
      </p>

      <h2>With an account</h2>
      <ul>
        <li>
          <b>Account</b>: username, encrypted password (never stored in plain text), sign-up date, last activity date (shown to other
          players: “online”, “seen … ago”).
        </li>
        <li>
          <b>Email address (optional)</b>: only to confirm it belongs to you and to send you a link if you forget your password.
          Never shown to other players, never used for advertising. You can change or remove it at any time (👤 Account › My email
          address). Links sent expire after 1 hour (password) or 48 hours (confirmation).
        </li>
        <li>
          <b>Synced progress</b>: the app’s data (rating, XP, games, achievements, settings, repertoire, coach notes, shop inventory) so
          you find it on all your devices.
        </li>
        <li>
          <b>Public profile</b>: username, photo if you add one, level, statistics, achievements, gallery of beaten bots, ratings and
          rankings. This information is visible to other players.
        </li>
        <li>
          <b>Community</b>: lounge messages (public), private messages, friend requests, muted players, challenges, online games and
          their chat, daily puzzle and Puzzle Rush results (public leaderboards).
        </li>
        <li>
          <b>Referrals (events)</b>: who invited whom. Your invite link contains your username; your referrals and the inviter
          leaderboard are visible in the Events tab.
        </li>
      </ul>

      <h2>Support</h2>
      <p>
        When you write to support: your name or username, your email if you give it (only to reply to you), your message and, if you
        leave the box checked, technical information (page, browser, screen size, username). Kept for 2 years at most.
      </p>

      <h2>Security and technical logs</h2>
      <p>
        Your IP address is used, in memory and for a few minutes, to limit abuse (login attempts, spam). The server may keep
        technical logs (IP address, requested page, date) for security, kept for 12 months at most as required by law. Passwords are
        hashed (bcrypt), the session is a protected cookie (httpOnly), and all traffic goes over HTTPS.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        A single cookie: <code>bm_session</code>, which keeps you signed in (90 days). The browser’s local storage keeps your progress
        and settings. Both are strictly necessary for the site to work: they require no consent and are never used to track you.
      </p>

      <h2>Audience measurement</h2>
      <p>
        To know how many people visit BetterMove, the server counts unique visitors each day, without cookies and without storing
        anything on your device. It computes a fingerprint from your IP address and browser, mixed with a random value that changes
        every day and is not kept: your IP address is never stored, and you can’t be followed from one day to the next. Along with this daily
        fingerprint we note: the pages viewed (with no username or number in the address), the device type, browser and system, the browser
        language, the site you came from (domain name only) and the time you arrived. Only overall figures are shown (visitors per day,
        signed in or not, most viewed pages…). The data is deleted after 13 months.
      </p>

      <h2>Third-party services</h2>
      <p>
        Game import contacts Lichess (lichess.org) or chess.com (api.chess.com) directly from your browser, with the username you
        enter. Their own privacy policies apply. Nothing else is loaded from a third-party site (no fonts, scripts or analytics).
      </p>

      <h2>Legal bases</h2>
      <ul>
        <li>Performance of the service you request: account, sync, online play, messaging.</li>
        <li>Legitimate interest: security, fighting abuse, community moderation.</li>
        <li>Consent: account email address, profile photo, email left with support, attached technical information.</li>
      </ul>

      <h2>Recipients and hosting</h2>
      <p>
        The data is shared with no one. Only the server host ({todo(LEGAL.hostName)}) has technical access to it, on behalf of{' '}
        {LEGAL.siteName}.
      </p>

      <h2>Retention periods</h2>
      <ul>
        <li>Account and related data: as long as the account exists. An account inactive for 3 years is deleted.</li>
        <li>Support requests: 2 years.</li>
        <li>Technical logs: 12 months at most.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can access your data, correct it, retrieve it, object to its processing or have it erased. Directly in the app
        (👤 Account): <b>Download my data</b> (complete file) and <b>Delete my account</b> (immediate and permanent erasure). For any
        other request: {support}. You can also contact the French data protection authority, the CNIL (www.cnil.fr).
      </p>

      <h2>Minors</h2>
      <p>
        If you are under 15, ask a parent for permission before creating an account. The lounge and private messages are moderated
        (word filter, muting, message removal by moderators).
      </p>
    </>
  );
}

export function TermsEn({ support }: { support: ReactNode }) {
  return (
    <>
      <h1>Terms of use</h1>
      <h2>The service</h2>
      <p>
        {LEGAL.siteName} is free, with no ads or purchases. It is provided as is, with no guarantee of availability: it may change, be
        interrupted or shut down. Remember to download your data if it matters to you.
      </p>
      <h2>Your account</h2>
      <p>
        One account per person. You are responsible for your password. Your username must not be offensive or impersonate anyone.
      </p>
      <h2>Respect for other players</h2>
      <ul>
        <li>No insults, harassment, hateful remarks, shocking content or spam.</li>
        <li>No personal data of others (address, phone…) in messages.</li>
        <li>No outside help (engine, another person) during a rated online game.</li>
      </ul>
      <p>
        In case of violation, messages may be deleted and the account suspended or deleted. To report a problem: {support}.
      </p>
      <h2>Coins and shop items</h2>
      <p>
        Coins 🪙, skins, sounds and emojis are virtual game items, earned by playing. They have no monetary value, cannot be bought
        with real money and can be neither exchanged nor refunded for money.
      </p>
      <h2>What you post</h2>
      <p>
        You remain the owner of your messages and your photo. You allow {LEGAL.siteName} to display them to other players for as long
        as they are online. You can remove them by deleting your account.
      </p>
      <h2>Governing law</h2>
      <p>These terms are governed by French law.</p>
    </>
  );
}

export const THIRD_PARTY_LICENSES: { name: string; use: string; license: string; url: string }[] = [
  { name: 'chessground', use: 'Interactive chessboard and its styles', license: 'GPL-3.0-or-later', url: 'https://github.com/lichess-org/chessground' },
  { name: '“cburnett” pieces', use: 'Piece drawings (and skin masks)', license: 'GPL-2.0-or-later, BSD or GFDL, your choice (Colin M.L. Burnett)', url: 'https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces' },
  { name: 'Stockfish 19 (WebAssembly port stockfish.js, lite version)', use: 'Analysis engine and bots', license: 'GPL-3.0', url: 'https://github.com/nmrugg/stockfish.js' },
  { name: 'chess.js', use: 'Game rules', license: 'BSD-2-Clause', url: 'https://github.com/jhlywa/chess.js' },
  { name: 'React', use: 'Interface', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'Lichess puzzle database', use: 'Puzzles and Puzzle Rush', license: 'CC0 (public domain)', url: 'https://database.lichess.org/#puzzles' },
  { name: 'lichess-org/chess-openings', use: 'Opening names', license: 'CC0 (public domain)', url: 'https://github.com/lichess-org/chess-openings' },
  { name: 'Figtree, Bricolage Grotesque (Fontsource)', use: 'Typefaces', license: 'SIL Open Font License 1.1', url: 'https://fontsource.org/' },
  { name: 'Lucide', use: 'Icons', license: 'ISC', url: 'https://lucide.dev/' },
  { name: 'Express, pg, bcryptjs, jsonwebtoken, nodemailer, cookie-parser', use: 'Server', license: 'MIT', url: 'https://www.npmjs.com/' },
];

export function LicencesEn() {
  return (
    <>
      <h1>Licenses and source code</h1>
      <p>
        {LEGAL.siteName} is free software: you can use, study, modify and redistribute it under the terms of the GNU General Public
        License version 3 or later (GPL-3.0-or-later), without any warranty. This choice follows from the free components it relies
        on (chessground board, Stockfish engine).
      </p>
      <p>
        <b>Full source code:</b>{' '}
        {LEGAL.sourceUrl ? (
          <a href={LEGAL.sourceUrl} target="_blank" rel="noopener noreferrer">
            {LEGAL.sourceUrl}
          </a>
        ) : (
          todo('')
        )}
      </p>
      <p>
        License text: <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer">gnu.org/licenses/gpl-3.0</a>
      </p>
      <h2>Third-party components</h2>
      <div className="legal-table-wrap">
        <table className="legal-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Use</th>
              <th>License</th>
            </tr>
          </thead>
          <tbody>
            {THIRD_PARTY_LICENSES.map((x) => (
              <tr key={x.name}>
                <td>
                  <a href={x.url} target="_blank" rel="noopener noreferrer">
                    {x.name}
                  </a>
                </td>
                <td>{x.use}</td>
                <td>{x.license}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        The bots, their portraits and dialogue, the lessons, skins, sounds (synthesized in the browser) and emojis are original creations
        of {LEGAL.siteName}. Lichess and chess.com are trademarks of their owners: no affiliation.
      </p>
    </>
  );
}

/** Tableau des composants tiers, avec les usages traduits dans l'ordre de THIRD_PARTY_LICENSES */
export function ThirdPartyTable({ head, uses }: { head: [string, string, string]; uses: string[] }) {
  return (
    <div className="legal-table-wrap">
      <table className="legal-table">
        <thead>
          <tr>
            <th>{head[0]}</th>
            <th>{head[1]}</th>
            <th>{head[2]}</th>
          </tr>
        </thead>
        <tbody>
          {THIRD_PARTY_LICENSES.map((x, i) => (
            <tr key={x.name}>
              <td>
                <a href={x.url} target="_blank" rel="noopener noreferrer">
                  {x.name}
                </a>
              </td>
              <td>{uses[i] ?? x.use}</td>
              <td>{x.license}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
