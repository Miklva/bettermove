// Paginas legales en espagnol. La version francaise fait foi : un bandeau le rappelle en haut de chaque document.
import type { ReactNode } from 'react';
import { LEGAL } from '../legal/config';
import { ThirdPartyTable } from './LegalPageEn';

const todo = (v: string) => v || '[por completar]';

export function MentionsEs({ support }: { support: ReactNode }) {
  return (
    <>
      <h1>Aviso legal</h1>
      <h2>Editor</h2>
      {LEGAL.editor ? (
        <p>{LEGAL.editor}</p>
      ) : (
        <p>
          {LEGAL.siteName} es un proyecto independiente y sin ánimo de lucro publicado por un particular. Conforme al artículo 6 III 2
          de la ley francesa para la confianza en la economía digital (LCEN), su identidad se ha comunicado al proveedor de alojamiento
          indicado más abajo.
        </p>
      )}
      <p>Contacto: {support} (disponible en el menú ❓ › Contactar con el soporte).</p>
      <h2>Alojamiento</h2>
      <p>
        {todo(LEGAL.hostName)}
        <br />
        {todo(LEGAL.hostAddress)}
        <br />
        {todo(LEGAL.hostPhone)}
      </p>
      <h2>Propiedad intelectual</h2>
      <p>
        El código de {LEGAL.siteName} es software libre publicado bajo la licencia GNU GPL versión 3 o posterior (ver la pestaña
        «Licencias y código fuente»). Lichess y chess.com son marcas de sus respectivos titulares: {LEGAL.siteName} no está afiliado a
        ellos, ni respaldado ni patrocinado por ellos. Solo se mencionan para que puedas importar tus propias partidas.
      </p>
    </>
  );
}

export function PrivacyEs({ support }: { support: ReactNode }) {
  return (
    <>
      <h1>Política de privacidad</h1>
      <p>
        {LEGAL.siteName} solo recoge lo estrictamente necesario para que el sitio funcione. Sin publicidad, sin analítica de terceros,
        sin rastreadores de terceros y sin venta de datos.
      </p>

      <h2>Sin cuenta</h2>
      <p>
        Tu progreso (nivel, Elo, partidas, logros, ajustes, notas) se guarda solo en tu navegador (almacenamiento local). Nunca sale de
        tu dispositivo. Puedes borrarlo cuando quieras: 👤 Cuenta › Borrar los datos de este navegador.
      </p>

      <h2>Con cuenta</h2>
      <ul>
        <li>
          <b>Cuenta</b>: nombre de usuario, contraseña cifrada (nunca se guarda en claro), fecha de registro y fecha de última actividad
          (visible para los demás jugadores: «en línea», «visto hace…»).
        </li>
        <li>
          <b>Correo electrónico (opcional)</b>: solo para confirmar que es tuyo y enviarte un enlace si olvidas tu contraseña. Nunca se
          muestra a otros jugadores ni se usa para publicidad. Puedes cambiarlo o eliminarlo cuando quieras (👤 Cuenta › Mi correo
          electrónico). Los enlaces enviados caducan en 1 hora (contraseña) o 48 horas (confirmación).
        </li>
        <li>
          <b>Progreso sincronizado</b>: los datos de la app (Elo, XP, partidas, logros, ajustes, repertorio, notas del seguimiento,
          inventario de la tienda) para que los encuentres en todos tus dispositivos.
        </li>
        <li>
          <b>Perfil público</b>: nombre de usuario, foto si añades una, nivel, estadísticas, logros, galería de bots vencidos, Elo y
          clasificaciones. Esta información es visible para los demás jugadores.
        </li>
        <li>
          <b>Comunidad</b>: mensajes del salón (públicos), mensajes privados, solicitudes de amistad, jugadores silenciados, desafíos,
          partidas en línea y su chat, resultados del problema del día y del Puzzle Rush (clasificaciones públicas).
        </li>
        <li>
          <b>Invitaciones (eventos)</b>: quién ha invitado a quién. Tu enlace de invitación contiene tu nombre de usuario; tus invitados
          y la clasificación de padrinos son visibles en la pestaña Eventos.
        </li>
      </ul>

      <h2>Soporte</h2>
      <p>
        Cuando escribes al soporte: tu nombre o usuario, tu correo si lo indicas (solo para responderte), tu mensaje y, si dejas la
        casilla marcada, información técnica (página, navegador, tamaño de pantalla, usuario). Se conserva 2 años como máximo.
      </p>

      <h2>Seguridad y registros técnicos</h2>
      <p>
        Tu dirección IP se usa, en memoria y durante unos minutos, para limitar abusos (intentos de conexión, spam). El servidor puede
        conservar registros técnicos (dirección IP, página solicitada, fecha) por seguridad, durante 12 meses como máximo según exige la
        ley. Las contraseñas se cifran (bcrypt), la sesión es una cookie protegida (httpOnly) y todo el tráfico pasa por HTTPS.
      </p>

      <h2>Cookies y almacenamiento local</h2>
      <p>
        Una sola cookie: <code>bm_session</code>, que mantiene tu sesión iniciada (90 días). El almacenamiento local del navegador guarda
        tu progreso y tus ajustes. Ambos son estrictamente necesarios para que el sitio funcione: no requieren consentimiento y nunca se
        usan para rastrearte.
      </p>

      <h2>Medición de audiencia</h2>
      <p>
        Para saber cuántas personas visitan BetterMove, el servidor cuenta los visitantes únicos de cada día, sin cookies y sin guardar
        nada en tu dispositivo. Calcula una huella a partir de tu dirección IP y tu navegador, mezclada con un valor aleatorio que cambia
        cada día y no se conserva: tu dirección IP nunca se guarda y no se te puede seguir de un día para otro. Junto con esta huella
        del día se anotan: las páginas vistas (sin nombre de usuario ni número en la dirección), el tipo de dispositivo, el navegador y el
        sistema, el idioma del navegador, el sitio desde el que llegas (solo el nombre de dominio) y la hora de llegada. Solo se muestran
        cifras globales (visitantes por día, con sesión o sin ella, páginas más vistas…). Los datos se borran a los 13 meses.
      </p>

      <h2>Servicios de terceros</h2>
      <p>
        La importación de partidas contacta directamente con Lichess (lichess.org) o chess.com (api.chess.com) desde tu navegador, con
        el nombre de usuario que introduces. Se aplican sus propias políticas de privacidad. No se carga nada más desde un sitio de
        terceros (ni fuentes, ni scripts, ni analítica).
      </p>

      <h2>Bases legales</h2>
      <ul>
        <li>Ejecución del servicio que solicitas: cuenta, sincronización, juego en línea, mensajería.</li>
        <li>Interés legítimo: seguridad, lucha contra los abusos, moderación de la comunidad.</li>
        <li>Consentimiento: correo de la cuenta, foto de perfil, correo dejado al soporte, información técnica adjunta.</li>
      </ul>

      <h2>Destinatarios y alojamiento</h2>
      <p>
        Los datos no se comparten con nadie. Solo el proveedor de alojamiento del servidor ({todo(LEGAL.hostName)}) tiene acceso técnico
        a ellos, por cuenta de {LEGAL.siteName}.
      </p>

      <h2>Plazos de conservación</h2>
      <ul>
        <li>Cuenta y datos asociados: mientras exista la cuenta. Una cuenta inactiva durante 3 años se elimina.</li>
        <li>Solicitudes al soporte: 2 años.</li>
        <li>Registros técnicos: 12 meses como máximo.</li>
      </ul>

      <h2>Tus derechos</h2>
      <p>
        Puedes acceder a tus datos, rectificarlos, recuperarlos, oponerte a su tratamiento o pedir su supresión. Directamente en la app
        (👤 Cuenta): <b>Descargar mis datos</b> (archivo completo) y <b>Eliminar mi cuenta</b> (borrado inmediato y definitivo). Para
        cualquier otra solicitud: {support}. También puedes dirigirte a la autoridad francesa de protección de datos, la CNIL
        (www.cnil.fr).
      </p>

      <h2>Menores</h2>
      <p>
        Si tienes menos de 15 años, pide permiso a uno de tus padres antes de crear una cuenta. El salón y los mensajes privados están
        moderados (filtro de palabras, silenciamiento, borrado de mensajes por los moderadores).
      </p>
    </>
  );
}

export function TermsEs({ support }: { support: ReactNode }) {
  return (
    <>
      <h1>Condiciones de uso</h1>
      <h2>El servicio</h2>
      <p>
        {LEGAL.siteName} es gratuito, sin publicidad ni compras. Se ofrece tal cual, sin garantía de disponibilidad: puede cambiar,
        interrumpirse o cerrar. Acuérdate de descargar tus datos si te importan.
      </p>
      <h2>Tu cuenta</h2>
      <p>
        Una cuenta por persona. Eres responsable de tu contraseña. Tu nombre de usuario no debe ser ofensivo ni suplantar a nadie.
      </p>
      <h2>Respeto a los demás jugadores</h2>
      <ul>
        <li>Nada de insultos, acoso, comentarios de odio, contenido chocante ni spam.</li>
        <li>Nada de datos personales de otras personas (dirección, teléfono…) en los mensajes.</li>
        <li>Nada de ayuda externa (motor, otra persona) durante una partida en línea clasificatoria.</li>
      </ul>
      <p>
        En caso de incumplimiento, los mensajes pueden borrarse y la cuenta suspenderse o eliminarse. Para informar de un problema:{' '}
        {support}.
      </p>
      <h2>Monedas y objetos de la tienda</h2>
      <p>
        Las monedas 🪙, skins, sonidos y emojis son objetos virtuales del juego, que se ganan jugando. No tienen valor monetario, no se
        pueden comprar con dinero real y no se pueden cambiar ni reembolsar por dinero.
      </p>
      <h2>Lo que publicas</h2>
      <p>
        Sigues siendo el propietario de tus mensajes y de tu foto. Autorizas a {LEGAL.siteName} a mostrarlos a los demás jugadores
        mientras estén en línea. Puedes retirarlos eliminando tu cuenta.
      </p>
      <h2>Ley aplicable</h2>
      <p>Estas condiciones se rigen por la ley francesa.</p>
    </>
  );
}

export function LicencesEs() {
  return (
    <>
      <h1>Licencias y código fuente</h1>
      <p>
        {LEGAL.siteName} es software libre: puedes usarlo, estudiarlo, modificarlo y redistribuirlo según los términos de la Licencia
        Pública General de GNU versión 3 o posterior (GPL-3.0-or-later), sin ninguna garantía. Esta elección se debe a los componentes
        libres en los que se basa (tablero chessground, motor Stockfish).
      </p>
      <p>
        <b>Código fuente completo:</b>{' '}
        {LEGAL.sourceUrl ? (
          <a href={LEGAL.sourceUrl} target="_blank" rel="noopener noreferrer">
            {LEGAL.sourceUrl}
          </a>
        ) : (
          todo('')
        )}
      </p>
      <p>
        Texto de la licencia: <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer">gnu.org/licenses/gpl-3.0</a>
      </p>
      <h2>Componentes de terceros</h2>
      <ThirdPartyTable head={['Componente', 'Uso', 'Licencia']} uses={USES} />
      <p className="muted small">
        Los bots, sus retratos y diálogos, las lecciones, los skins, los sonidos (sintetizados en el navegador) y los emojis son
        creaciones originales de {LEGAL.siteName}. Lichess y chess.com son marcas de sus titulares: sin afiliación.
      </p>
    </>
  );
}

const USES = ['Tablero interactivo y sus estilos', 'Dibujo de las piezas (y máscaras de los skins)', 'Motor de análisis y bots', 'Reglas del juego', 'Interfaz', 'Problemas y Puzzle Rush', 'Nombres de las aperturas', 'Tipografías', 'Iconos', 'Servidor'];
