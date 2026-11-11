// Pages legales en portugais (Portugal). La version francaise fait foi : un bandeau le rappelle en haut de chaque document.
import type { ReactNode } from 'react';
import { LEGAL } from '../legal/config';
import { ThirdPartyTable } from './LegalPageEn';

const todo = (v: string) => v || '[a preencher]';

export function MentionsPt({ support }: { support: ReactNode }) {
  return (
    <>
      <h1>Informação legal</h1>
      <h2>Editor</h2>
      {LEGAL.editor ? (
        <p>{LEGAL.editor}</p>
      ) : (
        <p>
          {LEGAL.siteName} é um projeto independente e sem fins lucrativos publicado por um particular. Nos termos do artigo 6 III 2 da
          lei francesa para a confiança na economia digital (LCEN), a sua identidade foi comunicada ao fornecedor de alojamento indicado
          abaixo.
        </p>
      )}
      <p>Contacto: {support} (disponível no menu ❓ › Contactar o suporte).</p>
      <h2>Alojamento</h2>
      <p>
        {todo(LEGAL.hostName)}
        <br />
        {todo(LEGAL.hostAddress)}
        <br />
        {todo(LEGAL.hostPhone)}
      </p>
      <h2>Propriedade intelectual</h2>
      <p>
        O código do {LEGAL.siteName} é software livre publicado sob a licença GNU GPL versão 3 ou posterior (ver o separador «Licenças
        e código-fonte»). Lichess e chess.com são marcas dos respetivos titulares: o {LEGAL.siteName} não é afiliado, apoiado nem
        patrocinado por eles. São mencionados apenas para que possas importar as tuas próprias partidas.
      </p>
    </>
  );
}

export function PrivacyPt({ support }: { support: ReactNode }) {
  return (
    <>
      <h1>Política de privacidade</h1>
      <p>
        O {LEGAL.siteName} recolhe apenas o estritamente necessário para o funcionamento do site. Sem publicidade, sem estatísticas de
        terceiros, sem rastreadores de terceiros e sem venda de dados.
      </p>

      <h2>Sem conta</h2>
      <p>
        O teu progresso (nível, Elo, partidas, conquistas, definições, notas) fica guardado apenas no teu navegador (armazenamento
        local). Nunca sai do teu dispositivo. Podes apagá-lo quando quiseres: 👤 Conta › Apagar os dados deste navegador.
      </p>

      <h2>Com conta</h2>
      <ul>
        <li>
          <b>Conta</b>: nome de utilizador, palavra-passe cifrada (nunca guardada em claro), data de registo e data da última atividade
          (visível para os outros jogadores: «online», «visto há…»).
        </li>
        <li>
          <b>Endereço de e-mail (opcional)</b>: apenas para confirmar que é teu e para te enviar um link se te esqueceres da
          palavra-passe. Nunca é mostrado a outros jogadores nem usado para publicidade. Podes alterá-lo ou removê-lo quando quiseres
          (👤 Conta › O meu e-mail). Os links enviados expiram ao fim de 1 hora (palavra-passe) ou 48 horas (confirmação).
        </li>
        <li>
          <b>Progresso sincronizado</b>: os dados da app (Elo, XP, partidas, conquistas, definições, repertório, notas do
          acompanhamento, inventário da loja) para os encontrares em todos os teus dispositivos.
        </li>
        <li>
          <b>Perfil público</b>: nome de utilizador, fotografia se adicionares uma, nível, estatísticas, conquistas, galeria de bots
          vencidos, Elo e classificações. Esta informação é visível para os outros jogadores.
        </li>
        <li>
          <b>Comunidade</b>: mensagens do salão (públicas), mensagens privadas, pedidos de amizade, jogadores silenciados, desafios,
          partidas online e o seu chat, resultados do problema do dia e do Puzzle Rush (classificações públicas).
        </li>
        <li>
          <b>Convites (eventos)</b>: quem convidou quem. O teu link de convite contém o teu nome de utilizador; os teus convidados e a
          classificação dos padrinhos são visíveis no separador Eventos.
        </li>
      </ul>

      <h2>Suporte</h2>
      <p>
        Quando escreves ao suporte: o teu nome ou utilizador, o teu e-mail se o indicares (apenas para te responder), a tua mensagem e,
        se deixares a caixa marcada, informações técnicas (página, navegador, tamanho do ecrã, utilizador). Guardado 2 anos no máximo.
      </p>

      <h2>Segurança e registos técnicos</h2>
      <p>
        O teu endereço IP é usado, em memória e durante alguns minutos, para limitar abusos (tentativas de ligação, spam). O servidor
        pode guardar registos técnicos (endereço IP, página pedida, data) por segurança, durante 12 meses no máximo, como exige a lei.
        As palavras-passe são cifradas (bcrypt), a sessão é um cookie protegido (httpOnly) e todo o tráfego passa por HTTPS.
      </p>

      <h2>Cookies e armazenamento local</h2>
      <p>
        Um único cookie: <code>bm_session</code>, que mantém a tua sessão iniciada (90 dias). O armazenamento local do navegador guarda
        o teu progresso e as tuas definições. Ambos são estritamente necessários ao funcionamento do site: não exigem consentimento e
        nunca são usados para te seguir.
      </p>

      <h2>Medição de audiência</h2>
      <p>
        Para saber quantas pessoas visitam o BetterMove, o servidor conta os visitantes únicos de cada dia, sem cookies e sem guardar
        nada no teu dispositivo. Calcula uma impressão digital a partir do teu endereço IP e do teu navegador, misturada com um valor
        aleatório que muda todos os dias e não é guardado: o teu endereço IP nunca é guardado e não podes ser seguido de um dia para o
        outro. Com esta impressão do dia são registados: as páginas vistas (sem nome de utilizador nem número no
        endereço), o tipo de dispositivo, o navegador e o sistema, o idioma do navegador, o site de onde vens (só o nome de domínio) e a
        hora de chegada. Só são mostrados números globais (visitantes por dia, com ou sem sessão, páginas mais vistas…). Os dados são
        apagados ao fim de 13 meses.
      </p>

      <h2>Serviços de terceiros</h2>
      <p>
        A importação de partidas contacta diretamente o Lichess (lichess.org) ou o chess.com (api.chess.com) a partir do teu navegador,
        com o nome de utilizador que introduzes. Aplicam-se as respetivas políticas de privacidade. Nada mais é carregado de um site de
        terceiros (nem tipos de letra, nem scripts, nem estatísticas).
      </p>

      <h2>Fundamentos legais</h2>
      <ul>
        <li>Execução do serviço que pedes: conta, sincronização, jogo online, mensagens.</li>
        <li>Interesse legítimo: segurança, combate aos abusos, moderação da comunidade.</li>
        <li>Consentimento: e-mail da conta, fotografia de perfil, e-mail deixado ao suporte, informações técnicas anexadas.</li>
      </ul>

      <h2>Destinatários e alojamento</h2>
      <p>
        Os dados não são partilhados com ninguém. Apenas o fornecedor de alojamento do servidor ({todo(LEGAL.hostName)}) tem acesso
        técnico a eles, por conta do {LEGAL.siteName}.
      </p>

      <h2>Prazos de conservação</h2>
      <ul>
        <li>Conta e dados associados: enquanto a conta existir. Uma conta inativa durante 3 anos é apagada.</li>
        <li>Pedidos ao suporte: 2 anos.</li>
        <li>Registos técnicos: 12 meses no máximo.</li>
      </ul>

      <h2>Os teus direitos</h2>
      <p>
        Podes aceder aos teus dados, corrigi-los, recuperá-los, opor-te ao seu tratamento ou pedir o seu apagamento. Diretamente na app
        (👤 Conta): <b>Descarregar os meus dados</b> (ficheiro completo) e <b>Apagar a minha conta</b> (apagamento imediato e
        definitivo). Para qualquer outro pedido: {support}. Também podes contactar a autoridade francesa de proteção de dados, a CNIL
        (www.cnil.fr).
      </p>

      <h2>Menores</h2>
      <p>
        Se tens menos de 15 anos, pede autorização a um dos teus pais antes de criares uma conta. O salão e as mensagens privadas são
        moderados (filtro de palavras, silenciamento, remoção de mensagens pelos moderadores).
      </p>
    </>
  );
}

export function TermsPt({ support }: { support: ReactNode }) {
  return (
    <>
      <h1>Condições de utilização</h1>
      <h2>O serviço</h2>
      <p>
        O {LEGAL.siteName} é gratuito, sem publicidade nem compras. É fornecido tal como está, sem garantia de disponibilidade: pode
        mudar, ser interrompido ou encerrado. Lembra-te de descarregar os teus dados se forem importantes para ti.
      </p>
      <h2>A tua conta</h2>
      <p>
        Uma conta por pessoa. És responsável pela tua palavra-passe. O teu nome de utilizador não deve ser ofensivo nem fazer-se passar
        por outra pessoa.
      </p>
      <h2>Respeito pelos outros jogadores</h2>
      <ul>
        <li>Nada de insultos, assédio, comentários de ódio, conteúdos chocantes ou spam.</li>
        <li>Nada de dados pessoais de outras pessoas (morada, telefone…) nas mensagens.</li>
        <li>Nada de ajuda externa (motor, outra pessoa) durante uma partida online classificada.</li>
      </ul>
      <p>
        Em caso de incumprimento, as mensagens podem ser apagadas e a conta suspensa ou apagada. Para reportar um problema: {support}.
      </p>
      <h2>Moedas e objetos da loja</h2>
      <p>
        As moedas 🪙, skins, sons e emojis são objetos virtuais do jogo, ganhos a jogar. Não têm valor monetário, não podem ser
        comprados com dinheiro real e não podem ser trocados nem reembolsados em dinheiro.
      </p>
      <h2>O que publicas</h2>
      <p>
        Continuas a ser o dono das tuas mensagens e da tua fotografia. Autorizas o {LEGAL.siteName} a mostrá-las aos outros jogadores
        enquanto estiverem online. Podes removê-las apagando a tua conta.
      </p>
      <h2>Lei aplicável</h2>
      <p>Estas condições regem-se pela lei francesa.</p>
    </>
  );
}

export function LicencesPt() {
  return (
    <>
      <h1>Licenças e código-fonte</h1>
      <p>
        O {LEGAL.siteName} é software livre: podes usá-lo, estudá-lo, modificá-lo e redistribuí-lo nos termos da Licença Pública Geral
        GNU versão 3 ou posterior (GPL-3.0-or-later), sem qualquer garantia. Esta escolha decorre dos componentes livres em que se baseia
        (tabuleiro chessground, motor Stockfish).
      </p>
      <p>
        <b>Código-fonte completo:</b>{' '}
        {LEGAL.sourceUrl ? (
          <a href={LEGAL.sourceUrl} target="_blank" rel="noopener noreferrer">
            {LEGAL.sourceUrl}
          </a>
        ) : (
          todo('')
        )}
      </p>
      <p>
        Texto da licença: <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer">gnu.org/licenses/gpl-3.0</a>
      </p>
      <h2>Componentes de terceiros</h2>
      <ThirdPartyTable head={['Componente', 'Utilização', 'Licença']} uses={USES} />
      <p className="muted small">
        Os bots, os seus retratos e diálogos, as lições, os skins, os sons (sintetizados no navegador) e os emojis são criações originais
        do {LEGAL.siteName}. Lichess e chess.com são marcas dos seus titulares: sem afiliação.
      </p>
    </>
  );
}

const USES = ['Tabuleiro interativo e os seus estilos', 'Desenho das peças (e máscaras dos skins)', 'Motor de análise e bots', 'Regras do jogo', 'Interface', 'Problemas e Puzzle Rush', 'Nomes das aberturas', 'Tipos de letra', 'Ícones', 'Servidor'];
