"use client";

import { useEffect, useState } from "react";
import type { Classe, Regime, Tema } from "@/lib/tipos";
import {
  CLASSES,
  CLASSE_PADRAO,
  COR_TEMA,
  FORMATO,
  LOTE_REVISAO,
  ROTULO_CURTO,
  tamanhos,
  tempoDaBateria,
  TEMAS,
} from "@/lib/constantes";
import {
  contarPorTema,
  disponiveis,
  questoesIneditas,
  questoesParaRevisao,
} from "@/lib/questoes";
import type { Historico } from "@/lib/historico";
import {
  gravarPreferencias,
  lerPreferencias,
  PREFERENCIAS_PADRAO,
} from "@/lib/preferencias";
import CriarDesafio from "./CriarDesafio";
import type { Desafio } from "@/lib/desafio";

interface Props {
  historico: Historico;
  onIniciar: (
    /** Uma matéria é uma bateria; várias viram exames em sequência. */
    temas: Tema[],
    /** Questões **por matéria**. */
    quantidade: number,
    classe: Classe,
    cronometrar: boolean,
    cego: boolean,
    soIneditas: boolean,
  ) => void;
  onRevisar: (classe: Classe) => void;
  onAssuntos: () => void;
  onImprimir: (desafio: Desafio) => void;
}

export default function TelaInicio({
  historico,
  onIniciar,
  onRevisar,
  onAssuntos,
  onImprimir,
}: Props) {
  const [classe, setClasse] = useState<Classe>(CLASSE_PADRAO);
  // Matérias selecionadas, sempre na ordem de TEMAS. Uma é uma bateria; as
  // três são a prova completa — que deixou de ser um botão à parte para virar
  // "selecione tudo", porque era a mesma coisa com outro nome.
  const [escolhas, setEscolhas] = useState<Tema[]>([TEMAS[0]]);
  const formato = FORMATO[classe];
  const [quantidade, setQuantidade] = useState(FORMATO[CLASSE_PADRAO].questoes);
  const [cronometrar, setCronometrar] = useState(
    PREFERENCIAS_PADRAO.cronometrar,
  );
  const [cego, setCego] = useState(PREFERENCIAS_PADRAO.regime === "cego");
  const [soIneditas, setSoIneditas] = useState(false);
  // `null` = ninguém mexeu ainda, e aí quem manda é o histórico: quem nunca
  // fez bateria vê o bloco aberto — é a primeira vez que decide entre treino e
  // prova, e as duas descrições precisam estar na tela. Derivado, e não estado
  // inicial: o histórico chega depois da hidratação, e um `useState(...)` lido
  // no primeiro render abriria o bloco para todo mundo, para sempre.
  const [ajusteManual, setAjusteManual] = useState<boolean | null>(null);
  const ajustando = ajusteManual ?? historico.simulados.length === 0;
  const contagem = contarPorTema(classe);
  const opcoes = tamanhos(classe);

  // A quantidade é POR matéria, então o teto é o da matéria mais escassa entre
  // as escolhidas — senão uma delas viria curta sem avisar.
  const total = Math.min(...escolhas.map((t) => disponiveis(t, classe)));
  const limite = Math.min(quantidade, total);
  const errosAbertos = questoesParaRevisao(historico, classe).length;
  const ineditasNasEscolhidas = escolhas.reduce(
    (s, t) => s + questoesIneditas(historico, classe, t).length,
    0,
  );
  const todasAsMaterias = escolhas.length === TEMAS.length;

  function alternarTema(tema: Tema) {
    setEscolhas((atuais) =>
      atuais.includes(tema)
        ? // Nunca zero: sem matéria não há bateria, e um botão "iniciar"
          // desabilitado seria pior do que impedir o último clique.
          atuais.length === 1
          ? atuais
          : atuais.filter((t) => t !== tema)
        : TEMAS.filter((t) => t === tema || atuais.includes(t)),
    );
  }

  // Trocar de classe muda o formato da prova; a quantidade acompanha, senão
  // ficaria selecionado um número que nem aparece mais entre as opções.
  function trocarClasse(nova: Classe) {
    setClasse(nova);
    setQuantidade(FORMATO[nova].questoes);
  }

  // A classe escolhida sobrevive à bateria e ao recarregamento: quem estuda
  // para a C ou a A estuda para ela todo dia, e o componente é desmontado a
  // cada bateria — sem isto, cada volta ao início recomeçava na B.
  useEffect(() => {
    // Mesmo padrão de hidratação de `useHistorico`: o storage só existe no
    // cliente, e ler durante o render divergiria do HTML da build.
    const salvas = lerPreferencias();
    if (salvas.classe !== CLASSE_PADRAO) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      trocarClasse(salvas.classe);
    }
    setCego(salvas.regime === "cego");
    setCronometrar(salvas.cronometrar);
  }, []);

  // Mesclam por cima do storage atual, e não do estado local: tema e escala
  // pertencem ao painel de preferências, que tem o próprio estado vivo —
  // gravar o objeto daqui apagaria uma escolha feita lá nesta mesma sessão.
  function escolherClasse(nova: Classe) {
    trocarClasse(nova);
    gravarPreferencias({ ...lerPreferencias(), classe: nova });
  }

  function escolherRegime(novo: Regime) {
    setCego(novo === "cego");
    gravarPreferencias({ ...lerPreferencias(), regime: novo });
  }

  function escolherCronometro(ligado: boolean) {
    setCronometrar(ligado);
    gravarPreferencias({ ...lerPreferencias(), cronometrar: ligado });
  }

  return (
    <div className="space-y-6">
      {/* Classe, matéria e quantidade são UMA decisão — a bateria de hoje. Em
          três seções separadas por vãos largos, a tela parecia três telas, e
          o botão de iniciar caía longe demais do que ele inicia. */}
      <section className="space-y-5 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
        <div>
          <Rotulo>Classe</Rotulo>
          <div className="flex gap-2">
            {CLASSES.map((c) => (
              <button
                key={c}
                onClick={() => escolherClasse(c)}
                className={`min-w-0 flex-1 rounded-xl border-2 px-1.5 py-2.5 transition sm:px-3 sm:py-3 ${
                  classe === c
                    ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                    : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
                }`}
              >
                <div className="text-sm font-bold whitespace-nowrap sm:text-base">
                  Classe {c}
                </div>
                {/* Duas linhas fixas em vez de três: a 360 px, "15 questões ·
                    mín. 8" quebrava em "15 / questões · / mín. 8" e cada
                    cartão crescia 20 px. A quebra agora é onde faz sentido. */}
                <div className="mt-0.5 text-xs whitespace-nowrap opacity-70">
                  {FORMATO[c].questoes} questões
                </div>
                <div className="text-xs whitespace-nowrap opacity-70">
                  mín. {FORMATO[c].minimo}
                </div>
              </button>
            ))}
          </div>
          {classe === "C" && (
            <p className="mt-3 text-xs text-slate-500 italic dark:text-slate-400">
              A ementa da Classe C é um subconjunto da Classe B, então o banco
              cobre mais do que cai — há questões de cálculo (código de cores,
              Kirchhoff, associação de resistores) que só são cobradas a partir
              da Classe B.
            </p>
          )}
          {classe === "A" && (
            <p className="mt-3 text-xs text-slate-500 italic dark:text-slate-400">
              Inclui o acréscimo técnico da Classe A em Eletrônica. Legislação e
              Técnica e Ética têm a mesma ementa nas três classes — o que muda é
              o número de questões.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <Rotulo>
              {escolhas.length > 1 ? "Matérias" : "Matéria"}
            </Rotulo>
            {/* As três de uma vez são a prova completa da Anatel — o botão
                separado que existia aqui fazia exatamente isto. */}
            <button
              onClick={() => setEscolhas(todasAsMaterias ? [TEMAS[0]] : TEMAS)}
              aria-pressed={todasAsMaterias}
              className="mb-2 text-xs font-medium text-slate-500 underline dark:text-slate-400"
            >
              {todasAsMaterias ? "só uma" : "todas as 3"}
            </button>
          </div>
          <div
            role="group"
            aria-label="Matérias da bateria"
            className="grid gap-3 sm:grid-cols-3"
          >
            {TEMAS.map((tema) => {
              const ativo = escolhas.includes(tema);
              return (
                <BotaoTema
                  key={tema}
                  ativo={ativo}
                  titulo={ROTULO_CURTO[tema]}
                  detalhe={`${contagem[tema]} questões`}
                  // O fundo do tema entra só na escolhida: é ele que passa a
                  // dizer "selecionada" no lugar do esmaecimento das outras.
                  classes={`${COR_TEMA[tema].borda} ${COR_TEMA[tema].texto} ${
                    ativo ? COR_TEMA[tema].fundo : ""
                  }`}
                  onClick={() => alternarTema(tema)}
                />
              );
            })}
          </div>
          {escolhas.length > 1 && (
            <p className="mt-3 text-xs text-slate-500 italic dark:text-slate-400">
              {todasAsMaterias
                ? "As três em sequência, cada uma com seu cronômetro e seu mínimo — é a prova completa, do jeito que a Anatel aplica."
                : "Uma matéria de cada vez, em sequência: são exames separados, e a aprovação é matéria a matéria."}
            </p>
          )}
        </div>

        <div>
          <Rotulo>
            {escolhas.length > 1 ? "Quantidade por matéria" : "Quantidade"}
          </Rotulo>
          <div className="flex flex-wrap gap-2">
            {opcoes.map((n) => (
              <button
                key={n}
                onClick={() => setQuantidade(n)}
                disabled={n > total}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  quantidade === n
                    ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                    : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
                }`}
              >
                {n}
                {n === formato.questoes && (
                  <span className="ml-1.5 text-xs opacity-70">prova real</span>
                )}
              </button>
            ))}
          </div>
          {/* Uma linha, e não um parágrafo: as contagens já estão no cartão da
              classe. */}
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Prova real da Classe {classe}: {formato.questoes} questões,{" "}
            {formato.minimo} acertos, {formato.minutos} min — por matéria.
            {escolhas.length > 1 &&
              ` Aqui: ${limite} × ${escolhas.length} = ${limite * escolhas.length} questões, em ${escolhas.length} exames.`}
          </p>
        </div>
      </section>

      <section>
        {/* Recolhido para quem já escolheu antes: o regime e o cronômetro são
            lembrados (`lib/preferencias.ts`), então o resumo é a verdade e não
            uma promessa. Quem chega pela primeira vez vê os dois cartões
            abertos — a descrição do regime NÃO escolhido é justamente a que
            falta para decidir, e por isso os dois textos aparecem juntos em
            vez de um alternador de um botão só. */}
        {!ajustando ? (
          <button
            onClick={() => setAjusteManual(true)}
            aria-expanded={false}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm transition hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-500"
          >
            <span>
              <span className="font-semibold">
                {cego ? "Modo prova" : "Modo treino"}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {cronometrar
                  ? ` · cronômetro ${Math.round(tempoDaBateria(classe, limite) / 60)} min`
                  : " · sem cronômetro"}
              </span>
            </span>
            <span className="shrink-0 font-medium underline">ajustar</span>
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <Rotulo>Como conduzir</Rotulo>
              <button
                onClick={() => setAjusteManual(false)}
                aria-expanded={true}
                className="mb-2 text-xs font-medium text-slate-500 underline dark:text-slate-400"
              >
                recolher
              </button>
            </div>
            <div
              role="group"
              aria-label="Regime da bateria"
              className="mb-3 grid gap-3 sm:grid-cols-2"
            >
              <BotaoRegime
                ativo={!cego}
                titulo="Modo treino"
                detalhe="Gabarito e explicação a cada questão, na hora — é assim que se aprende o conteúdo."
                onClick={() => escolherRegime("treino")}
              />
              <BotaoRegime
                ativo={cego}
                titulo="Modo prova"
                detalhe="Sem gabarito até o fim, como no exame: dá para pular, voltar, trocar a resposta e deixar em branco."
                onClick={() => escolherRegime("cego")}
              />
            </div>
            <button
              onClick={() => escolherCronometro(!cronometrar)}
              aria-pressed={cronometrar}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                cronometrar
                  ? "border-slate-900 dark:border-slate-100"
                  : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
              }`}
            >
              <span>
                <span className="font-semibold">
                  {cronometrar ? "Cronômetro ligado" : "Cronômetro desligado"}
                </span>
                <span className="block text-sm text-slate-500 dark:text-slate-400">
                  {cronometrar
                    ? "Ritmo oficial; o que faltar conta como erro."
                    : "Sem limite de tempo, para estudar com calma."}
                </span>
              </span>
              {cronometrar && (
                <span className="shrink-0 font-mono text-lg font-bold tabular-nums">
                  {Math.round(tempoDaBateria(classe, limite) / 60)} min
                </span>
              )}
            </button>
          </>
        )}
      </section>

      {/* Fora do bloco recolhível de propósito: o número de inéditas é
          informação, não só controle — e some sozinho quando não há histórico
          ou quando o tema já foi coberto. */}
      {historico.simulados.length > 0 && ineditasNasEscolhidas > 0 && (
        <button
          onClick={() => setSoIneditas((v) => !v)}
          aria-pressed={soIneditas}
          className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
            soIneditas
              ? "border-slate-900 dark:border-slate-100"
              : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
          }`}
        >
          <span>
            <span className="font-semibold">
              {soIneditas ? "Só questões inéditas" : "Priorizar inéditas"}
            </span>
            <span className="block text-sm text-slate-500 dark:text-slate-400">
              {!soIneditas
                ? `${ineditasNasEscolhidas} em ${escolhas.map((t) => ROTULO_CURTO[t]).join(", ")} que você nunca viu.`
                : ineditasNasEscolhidas >= limite * escolhas.length
                  ? "As baterias saem inteiras do que você ainda não viu."
                  : "Onde faltarem inéditas, a bateria completa com questões já vistas."}
            </span>
          </span>
          <span className="shrink-0 font-mono text-lg font-bold tabular-nums">
            {ineditasNasEscolhidas}
          </span>
        </button>
      )}

      {/* No celular o botão fica colado no rodapé enquanto não chega a vez
          dele na página.
          
          Medido em produção: a configuração inteira empurra o "Iniciar" para
          1,3 tela (veterano) a 2,2 telas (320 px) abaixo da dobra, e a
          primeira tela termina na fileira de quantidades — nada indica que há
          um botão adiante. É `sticky`, e não um segundo botão fixo: o mesmo
          elemento flutua enquanto está fora de vista e assenta no lugar dele
          ao ser alcançado, então não existem dois caminhos para iniciar nem
          rótulo repetido para o leitor de tela.
          
          A faixa tem fundo opaco e borda superior porque o conteúdo passa por
          baixo; `env(safe-area-inset-bottom)` mantém o botão acima da barra de
          gestos do iPhone.

          O corte é em `lg`, e não em `sm`: o celular deitado tem 640 px de
          largura e 390 de altura — é justamente onde a barra mais serve. Do
          desktop para cima ela sai, porque lá a página quase cabe e uma faixa
          presa roubaria altura de quem já enxerga o conjunto. */}
      <div className="sticky bottom-0 z-30 -mx-4 border-t border-slate-200 bg-[var(--background)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 dark:border-slate-800">
        <button
          onClick={() =>
            onIniciar(escolhas, limite, classe, cronometrar, cego, soIneditas)
          }
          className="w-full rounded-xl bg-slate-900 px-6 py-4 text-base font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Iniciar {cego ? "modo prova" : "modo treino"} · {limite} questões
          {escolhas.length > 1 && ` × ${escolhas.length} matérias`}
        </button>
      </div>

      {/* A "prova completa" saiu daqui: virou selecionar as três matérias
          acima, que é o que ela sempre foi. Um botão à parte, com formato
          fixo, era um segundo caminho para a mesma bateria. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => onRevisar(classe)}
          disabled={errosAbertos === 0}
          className="rounded-xl border-2 border-slate-300 px-4 py-3 text-left transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:border-slate-500"
        >
          <div className="font-semibold">
            Revisar erros
            {errosAbertos > 0 && (
              <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                {errosAbertos}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {errosAbertos === 0
              ? "Nenhum erro em aberto — errou, aparece aqui."
              : errosAbertos > LOTE_REVISAO
                ? // O tamanho da sessão dito antes de começar: sem isto, o
                  // selo com 91 promete uma hora de leitura de explicações.
                  `Os ${LOTE_REVISAO} mais urgentes de ${errosAbertos}, começando pelos mais esquecidos.`
                : "Só as questões que você errou e ainda não corrigiu."}
          </div>
        </button>
        <button
          onClick={onAssuntos}
          className="rounded-xl border-2 border-slate-300 px-4 py-3 text-left transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
        >
          <div className="font-semibold">Estudar por assunto</div>
          <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            As seções reais do material — plano de bandas, propagação,
            indicativos — cada uma com sua bateria própria, em modo treino.
          </div>
        </button>
      </div>

      {/* Por último, e recolhido: organizar prova para outras pessoas é o que
          menos se faz aqui, e estava ocupando o espaço logo abaixo do botão
          principal. Usa a configuração escolhida lá em cima. */}
      <CriarDesafio
        temas={escolhas}
        quantidade={limite}
        classe={classe}
        onImprimir={onImprimir}
      />
    </div>
  );
}

/** Cabeçalho de campo: o mesmo rótulo curto em toda a configuração. */
function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
      {children}
    </h2>
  );
}

/**
 * Escolha de um entre dois regimes. O disco à esquerda repete por forma o que
 * o preenchimento já diz por cor — o resto da tela segue a mesma regra, e aqui
 * ela pesa mais: escolher errado só aparece depois, com a bateria em curso.
 */
function BotaoRegime({
  ativo,
  titulo,
  detalhe,
  onClick,
}: {
  ativo: boolean;
  titulo: string;
  detalhe: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={`rounded-xl border-2 p-4 text-left transition ${
        ativo
          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
          : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
      }`}
    >
      <div className="flex items-center gap-2 font-semibold">
        <span
          aria-hidden
          className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
            ativo ? "border-current" : "border-slate-400 dark:border-slate-600"
          }`}
        >
          {ativo && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
        </span>
        {titulo}
      </div>
      <p
        className={`mt-1 text-sm ${
          ativo ? "opacity-80" : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {detalhe}
      </p>
    </button>
  );
}

/**
 * Cartão de matéria.
 *
 * Estado não se marca com opacidade: `opacity-70` derrubava o título da
 * matéria para 2,9–4,2:1 e o detalhe para 2,66:1, abaixo do mínimo AA — e
 * ainda fazia a matéria disponível parecer desabilitada. A escolhida ganha o
 * fundo do próprio tema (passado em `classes`); as outras ficam em contraste
 * cheio.
 */
function BotaoTema({
  ativo,
  titulo,
  detalhe,
  classes,
  onClick,
}: {
  ativo: boolean;
  titulo: string;
  detalhe: string;
  classes: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 p-4 text-left transition ${classes} ${
        ativo
          ? "ring-2 ring-slate-900 ring-offset-2 ring-offset-[var(--background)] dark:ring-slate-100"
          : "hover:bg-current/5"
      }`}
    >
      <div className="font-semibold">{titulo}</div>
      <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        {detalhe}
      </div>
    </button>
  );
}
