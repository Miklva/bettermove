// Pages legales en allemand. La version francaise fait foi : un bandeau le rappelle en haut de chaque document.
import type { ReactNode } from 'react';
import { LEGAL } from '../legal/config';
import { ThirdPartyTable } from './LegalPageEn';

const todo = (v: string) => v || '[noch zu ergänzen]';

export function MentionsDe({ support }: { support: ReactNode }) {
  return (
    <>
      <h1>Impressum</h1>
      <h2>Herausgeber</h2>
      {LEGAL.editor ? (
        <p>{LEGAL.editor}</p>
      ) : (
        <p>
          {LEGAL.siteName} ist ein unabhängiges, nicht kommerzielles Projekt einer Privatperson. Gemäß Artikel 6 III 2 des französischen
          Gesetzes über das Vertrauen in die digitale Wirtschaft (LCEN) wurde ihre Identität dem unten genannten Hoster mitgeteilt.
        </p>
      )}
      <p>Kontakt: {support} (erreichbar über das Menü ❓ › Support kontaktieren).</p>
      <h2>Hosting</h2>
      <p>
        {todo(LEGAL.hostName)}
        <br />
        {todo(LEGAL.hostAddress)}
        <br />
        {todo(LEGAL.hostPhone)}
      </p>
      <h2>Geistiges Eigentum</h2>
      <p>
        Der Code von {LEGAL.siteName} ist freie Software unter der GNU GPL Version 3 oder neuer (siehe Tab „Lizenzen und Quellcode“).
        Lichess und chess.com sind Marken ihrer jeweiligen Inhaber: {LEGAL.siteName} ist mit ihnen weder verbunden noch von ihnen
        unterstützt oder gesponsert. Sie werden nur genannt, damit du deine eigenen Partien importieren kannst.
      </p>
    </>
  );
}

export function PrivacyDe({ support }: { support: ReactNode }) {
  return (
    <>
      <h1>Datenschutzerklärung</h1>
      <p>
        {LEGAL.siteName} erhebt nur, was für den Betrieb der Website unbedingt nötig ist. Keine Werbung, keine Analysedienste Dritter,
        keine Tracker Dritter, kein Verkauf von Daten.
      </p>

      <h2>Ohne Konto</h2>
      <p>
        Dein Fortschritt (Niveau, Elo, Partien, Erfolge, Einstellungen, Notizen) wird nur in deinem Browser gespeichert (lokaler
        Speicher). Er verlässt dein Gerät nie. Du kannst ihn jederzeit löschen: 👤 Konto › Daten dieses Browsers löschen.
      </p>

      <h2>Mit Konto</h2>
      <ul>
        <li>
          <b>Konto</b>: Benutzername, verschlüsseltes Passwort (nie im Klartext gespeichert), Registrierungsdatum, Datum der letzten
          Aktivität (für andere Spieler sichtbar: „online“, „gesehen vor …“).
        </li>
        <li>
          <b>E-Mail-Adresse (optional)</b>: nur um zu bestätigen, dass sie dir gehört, und um dir einen Link zu schicken, falls du dein
          Passwort vergisst. Wird anderen Spielern nie angezeigt und nie für Werbung genutzt. Du kannst sie jederzeit ändern oder
          entfernen (👤 Konto › Meine E-Mail-Adresse). Gesendete Links verfallen nach 1 Stunde (Passwort) bzw. 48 Stunden
          (Bestätigung).
        </li>
        <li>
          <b>Synchronisierter Fortschritt</b>: die Daten der App (Elo, XP, Partien, Erfolge, Einstellungen, Repertoire, Notizen des
          Trainings, Inventar des Shops), damit du sie auf all deinen Geräten wiederfindest.
        </li>
        <li>
          <b>Öffentliches Profil</b>: Benutzername, Foto (falls du eines hinzufügst), Level, Statistiken, Erfolge, Galerie der
          geschlagenen Bots, Elo und Ranglisten. Diese Informationen sind für andere Spieler sichtbar.
        </li>
        <li>
          <b>Community</b>: Nachrichten in der Lounge (öffentlich), private Nachrichten, Freundschaftsanfragen, stummgeschaltete Spieler,
          Herausforderungen, Online-Partien und ihr Chat, Ergebnisse der Tagesaufgabe und von Puzzle Rush (öffentliche Ranglisten).
        </li>
        <li>
          <b>Einladungen (Events)</b>: wer wen eingeladen hat. Dein Einladungslink enthält deinen Benutzernamen; deine Eingeladenen und
          die Rangliste der Einladenden sind im Tab Events sichtbar.
        </li>
      </ul>

      <h2>Support</h2>
      <p>
        Wenn du dem Support schreibst: dein Name oder Benutzername, deine E-Mail, falls du sie angibst (nur, um dir zu antworten), deine
        Nachricht und, wenn das Kästchen angehakt bleibt, technische Angaben (Seite, Browser, Bildschirmgröße, Benutzername).
        Aufbewahrung höchstens 2 Jahre.
      </p>

      <h2>Sicherheit und technische Protokolle</h2>
      <p>
        Deine IP-Adresse wird im Arbeitsspeicher für wenige Minuten genutzt, um Missbrauch einzuschränken (Anmeldeversuche, Spam). Der
        Server kann aus Sicherheitsgründen technische Protokolle (IP-Adresse, aufgerufene Seite, Datum) speichern, gesetzlich höchstens
        12 Monate lang. Passwörter werden gehasht (bcrypt), die Sitzung ist ein geschütztes Cookie (httpOnly), und der gesamte Verkehr
        läuft über HTTPS.
      </p>

      <h2>Cookies und lokaler Speicher</h2>
      <p>
        Ein einziges Cookie: <code>bm_session</code>, das dich angemeldet hält (90 Tage). Der lokale Speicher des Browsers bewahrt
        deinen Fortschritt und deine Einstellungen auf. Beides ist für den Betrieb der Website unbedingt erforderlich: Es braucht keine
        Einwilligung und wird nie verwendet, um dich zu verfolgen.
      </p>

      <h2>Reichweitenmessung</h2>
      <p>
        Um zu wissen, wie viele Menschen BetterMove besuchen, zählt der Server die eindeutigen Besucher pro Tag, ohne Cookies und ohne
        etwas auf deinem Gerät zu speichern. Er berechnet einen Fingerabdruck aus deiner IP-Adresse und deinem Browser, gemischt mit
        einem zufälligen Wert, der sich täglich ändert und nicht aufbewahrt wird: Deine IP-Adresse wird nie gespeichert, und du kannst
        nicht von einem Tag zum nächsten verfolgt werden. Zusammen mit diesem
        Tages-Fingerabdruck werden notiert: die aufgerufenen Seiten (ohne Benutzernamen oder Nummer in der Adresse), Gerätetyp, Browser und
        System, die Browsersprache, die Website, von der du kommst (nur der Domainname), und die Ankunftszeit. Angezeigt werden nur
        Gesamtzahlen (Besucher pro Tag, angemeldet oder nicht, meistbesuchte Seiten …). Die Daten werden nach 13 Monaten gelöscht.
      </p>

      <h2>Dienste Dritter</h2>
      <p>
        Der Partie-Import kontaktiert Lichess (lichess.org) oder chess.com (api.chess.com) direkt aus deinem Browser, mit dem
        Benutzernamen, den du eingibst. Es gelten deren eigene Datenschutzerklärungen. Sonst wird nichts von Websites Dritter geladen
        (keine Schriften, keine Skripte, keine Analyse).
      </p>

      <h2>Rechtsgrundlagen</h2>
      <ul>
        <li>Erfüllung des von dir gewünschten Dienstes: Konto, Synchronisierung, Online-Spiel, Nachrichten.</li>
        <li>Berechtigtes Interesse: Sicherheit, Bekämpfung von Missbrauch, Moderation der Community.</li>
        <li>Einwilligung: E-Mail-Adresse des Kontos, Profilfoto, beim Support hinterlassene E-Mail, beigefügte technische Angaben.</li>
      </ul>

      <h2>Empfänger und Hosting</h2>
      <p>
        Die Daten werden an niemanden weitergegeben. Nur der Hoster des Servers ({todo(LEGAL.hostName)}) hat im Auftrag von{' '}
        {LEGAL.siteName} technischen Zugriff darauf.
      </p>

      <h2>Speicherdauer</h2>
      <ul>
        <li>Konto und zugehörige Daten: solange das Konto besteht. Ein 3 Jahre lang inaktives Konto wird gelöscht.</li>
        <li>Support-Anfragen: 2 Jahre.</li>
        <li>Technische Protokolle: höchstens 12 Monate.</li>
      </ul>

      <h2>Deine Rechte</h2>
      <p>
        Du kannst auf deine Daten zugreifen, sie berichtigen, sie herunterladen, ihrer Verarbeitung widersprechen oder sie löschen
        lassen. Direkt in der App (👤 Konto): <b>Meine Daten herunterladen</b> (vollständige Datei) und <b>Mein Konto löschen</b>
        (sofortige und endgültige Löschung). Für jede andere Anfrage: {support}. Du kannst dich auch an die französische
        Datenschutzbehörde CNIL (www.cnil.fr) wenden.
      </p>

      <h2>Minderjährige</h2>
      <p>
        Wenn du unter 15 bist, frag ein Elternteil um Erlaubnis, bevor du ein Konto erstellst. Die Lounge und die privaten Nachrichten
        werden moderiert (Wortfilter, Stummschaltung, Löschen von Nachrichten durch Moderatoren).
      </p>
    </>
  );
}

export function TermsDe({ support }: { support: ReactNode }) {
  return (
    <>
      <h1>Nutzungsbedingungen</h1>
      <h2>Der Dienst</h2>
      <p>
        {LEGAL.siteName} ist kostenlos, ohne Werbung und ohne Käufe. Der Dienst wird so bereitgestellt, wie er ist, ohne Garantie für
        seine Verfügbarkeit: Er kann sich ändern, unterbrochen oder eingestellt werden. Lade deine Daten herunter, wenn sie dir wichtig
        sind.
      </p>
      <h2>Dein Konto</h2>
      <p>
        Ein Konto pro Person. Du bist für dein Passwort verantwortlich. Dein Benutzername darf nicht beleidigend sein und sich nicht als
        jemand anderes ausgeben.
      </p>
      <h2>Respekt gegenüber anderen Spielern</h2>
      <ul>
        <li>Keine Beleidigungen, keine Belästigung, keine Hassbotschaften, keine schockierenden Inhalte, kein Spam.</li>
        <li>Keine persönlichen Daten anderer (Adresse, Telefon …) in Nachrichten.</li>
        <li>Keine fremde Hilfe (Engine, andere Person) während einer gewerteten Online-Partie.</li>
      </ul>
      <p>
        Bei Verstößen können Nachrichten gelöscht und das Konto gesperrt oder gelöscht werden. Um ein Problem zu melden: {support}.
      </p>
      <h2>Münzen und Shop-Gegenstände</h2>
      <p>
        Münzen 🪙, Skins, Sounds und Emojis sind virtuelle Spielgegenstände, die man durch Spielen verdient. Sie haben keinen Geldwert,
        können nicht mit echtem Geld gekauft und weder gegen Geld getauscht noch erstattet werden.
      </p>
      <h2>Was du veröffentlichst</h2>
      <p>
        Du bleibst Eigentümer deiner Nachrichten und deines Fotos. Du erlaubst {LEGAL.siteName}, sie anderen Spielern anzuzeigen,
        solange sie online sind. Du kannst sie entfernen, indem du dein Konto löschst.
      </p>
      <h2>Anwendbares Recht</h2>
      <p>Diese Bedingungen unterliegen französischem Recht.</p>
    </>
  );
}

export function LicencesDe() {
  return (
    <>
      <h1>Lizenzen und Quellcode</h1>
      <p>
        {LEGAL.siteName} ist freie Software: Du darfst sie nach den Bedingungen der GNU General Public License Version 3 oder neuer
        (GPL-3.0-or-later) nutzen, untersuchen, ändern und weitergeben, ohne jede Gewährleistung. Diese Wahl ergibt sich aus den freien
        Komponenten, auf denen sie aufbaut (Brett chessground, Engine Stockfish).
      </p>
      <p>
        <b>Vollständiger Quellcode:</b>{' '}
        {LEGAL.sourceUrl ? (
          <a href={LEGAL.sourceUrl} target="_blank" rel="noopener noreferrer">
            {LEGAL.sourceUrl}
          </a>
        ) : (
          todo('')
        )}
      </p>
      <p>
        Lizenztext: <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer">gnu.org/licenses/gpl-3.0</a>
      </p>
      <h2>Komponenten Dritter</h2>
      <ThirdPartyTable head={['Komponente', 'Verwendung', 'Lizenz']} uses={USES} />
      <p className="muted small">
        Die Bots, ihre Porträts und Dialoge, die Lektionen, Skins, Sounds (im Browser synthetisiert) und Emojis sind eigene Werke von{' '}
        {LEGAL.siteName}. Lichess und chess.com sind Marken ihrer Inhaber: keine Verbindung.
      </p>
    </>
  );
}

const USES = ['Interaktives Brett und seine Stile', 'Figurenzeichnungen (und Skin-Masken)', 'Analyse-Engine und Bots', 'Spielregeln', 'Oberfläche', 'Aufgaben und Puzzle Rush', 'Eröffnungsnamen', 'Schriftarten', 'Symbole', 'Server'];
