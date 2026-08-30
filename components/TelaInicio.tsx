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
  errosVencidos,
  questoesParaRevisao,
} from "@/lib/questoes";
import { DIAS_PARA_VENCER } from "@/lib/prioridade";
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
  // Guarda a última matéria escolhida sozinha, para "só uma" devolver ela.
  const [sozinhaAnterior, setSozinhaAnterior] = useState<Tema>(TEMAS[0]);
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
  // Quantos desses erros já passaram do prazo. O sorteio da revisão sempre
  // priorizou os esquecidos; a tela só mostrava o total, e 91 não diz se a
  // revisão de hoje é urgente ou pode esperar.
  const vencidos = errosVencidos(historico, classe);
  const ineditasNasEscolhidas = escolhas.reduce(
    (s, t) => s + questoesIneditas(historico, classe, t).length,
    0,
  );
  // Quanto do acervo das matérias escolhidas já foi visto: é o que decide se
  // "priorizar inéditas" tem alguma coisa a dizer.
  const totalNasEscolhidas = escolhas.reduce(
    (s, t) => s + disponiveis(t, classe),
    0,
  );
  const cobertas = totalNasEscolhidas - ineditasNasEscolhidas;
  const todasAsMaterias = escolhas.length === TEMAS.length;

  /**
   * A matéria que estava sozinha antes de "todas as 3".
   *
   * Voltar para `TEMAS[0]` jogava quem estudava Eletrônica de volta em
   * Legislação — "só uma" desfaz a ação, e desfazer tem de devolver o estado
   * anterior, não um padrão.
   */
  const ultimaSozinha = escolhas.length === 1 ? escolhas[0] : sozinhaAnterior;

  function alternarTema(tema: Tema) {
    const proximas = escolhas.includes(tema)
      ? // Nunca zero: sem matéria não há bateria, e um botão "iniciar"
        // desabilitado seria pior do que impedir o último clique.
        escolhas.length === 1
        ? escolhas
        : escolhas.filter((t) => t !== tema)
      : TEMAS.filter((t) => t === tema || escolhas.includes(t));
    escolherTemas(proximas);
  }

  // Trocar de classe muda o formato da prova; a quantidade acompanha, senão
  // ficaria selecionado um número que nem aparece mais entre as opções.
  function trocarClasse(nova: Classe) {
    setClasse(nova);
    setQuantidade(FORMATO[nova].questoes);
  }

  // A hidratação usa `trocarClasse`, que redefine a quantidade — por isso ela
  // é lida do storage DEPOIS, e por isso trocar de classe pela interface tem
  // de gravar a quantidade nova junto: senão o storage guardaria um número
  // que a tela não está mostrando.

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
    // Matéria e quantidade voltam junto com a classe. Sem isto, quem treinava
    // a prova completa reencontrava "Legislação · 20 questões" a cada volta —
    // e a quantidade tinha de vir DEPOIS de `trocarClasse`, que a redefine
    // para o formato da classe.
    setEscolhas(salvas.temas);
    if (salvas.temas.length === 1) setSozinhaAnterior(salvas.temas[0]);
    setQuantidade(salvas.quantidade);
  }, []);

  // Mesclam por cima do storage atual, e não do estado local: tema e escala
  // pertencem ao painel de preferências, que tem o próprio estado vivo —
  // gravar o objeto daqui apagaria uma escolha feita lá nesta mesma sessão.
  function escolherClasse(nova: Classe) {
    trocarClasse(nova);
    gravarPreferencias({
      ...lerPreferencias(),
      classe: nova,
      quantidade: FORMATO[nova].questoes,
    });
  }

  function escolherRegime(novo: Regime) {
    setCego(novo === "cego");
    gravarPreferencias({ ...lerPreferencias(), regime: novo });
  }

  function escolherCronometro(ligado: boolean) {
    setCronometrar(ligado);
    gravarPreferencias({ ...lerPreferencias(), cronometrar: ligado });
  }

  function escolherTemas(novos: Tema[]) {
    setEscolhas(novos);
    if (novos.length === 1) setSozinhaAnterior(novos[0]);
    gravarPreferencias({ ...lerPreferencias(), temas: novos });
  }

  function escolherQuantidade(nova: number) {
    setQuantidade(nova);
    gravarPreferencias({ ...lerPreferencias(), quantidade: nova });
  }

  return (
    <div className="space-y-6">
      {/* Classe, matéria e quantidade são UMA decisão — a bateria de hoje. Em
          três seções separadas por vãos largos, a tela parecia três telas, e
          o botão de iniciar caía longe demais do que ele inicia. */}
      <section className="space-y-5 rounded-2xl border border-borda bg-superficie p-4">
        <div>
          <Rotulo>Classe</Rotulo>
          {/* `role="group"` com rótulo, como as matérias já tinham: sem isso o
              leitor de tela lia três botões soltos, sem dizer de que decisão
              eles fazem parte. */}
          <div role="group" aria-label="Classe da prova" className="flex gap-2">
            {CLASSES.map((c) => (
              <button
                key={c}
                onClick={() => escolherClasse(c)}
                aria-pressed={classe === c}
                className={`min-w-0 flex-1 rounded-xl border-2 px-1.5 py-2.5 transition sm:px-3 sm:py-3 ${
                  classe === c
                    ? "border-slate-900 bg-rebaixado font-semibold dark:border-slate-100"
                    : "border-borda-controle hover:border-slate-500 dark:hover:border-slate-400"
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
            <Rotulo>{escolhas.length > 1 ? "Matérias" : "Matéria"}</Rotulo>
            {/* As três de uma vez são a prova completa da Anatel — o botão
                separado que existia aqui fazia exatamente isto. */}
            {/* Era um link de 12 px com alvo de 57×16 — abaixo do mínimo de
                24×24 da WCAG e ao lado de cartões de 44 px. É por ele que se
                descobre a prova completa, o cenário mais valioso para quem
                está perto do exame: vira pílula, com altura de dedo. */}
            <button
              onClick={() =>
                escolherTemas(todasAsMaterias ? [ultimaSozinha] : TEMAS)
              }
              aria-pressed={todasAsMaterias}
              className="alvo-toque mb-1 rounded-full border-2 border-slate-300 px-4 text-xs font-medium transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
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
          <div
            role="group"
            aria-label="Questões por bateria"
            className="flex flex-wrap gap-2"
          >
            {opcoes.map((n) => (
              <button
                key={n}
                onClick={() => escolherQuantidade(n)}
                aria-pressed={quantidade === n}
                disabled={n > total}
                className={`alvo-toque rounded-lg border px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  quantidade === n
                    ? "border-slate-900 bg-rebaixado font-semibold dark:border-slate-100"
                    : "border-borda-controle hover:border-slate-500 dark:hover:border-slate-400"
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
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-borda bg-superficie px-4 py-3 text-left text-sm transition hover:border-slate-400 dark:hover:border-slate-500"
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
                className="alvo-toque -my-2 -mr-2 rounded-lg px-2 text-xs font-medium text-slate-500 underline dark:text-slate-400"
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
                  : "border-borda-controle hover:border-slate-500 dark:hover:border-slate-400"
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
          ou quando o tema já foi coberto.

          Também some no começo: para quem viu 20 de 350, "330 que você nunca
          viu" é uma obviedade que ocupa um cartão inteiro logo abaixo do botão
          principal — e o controle não muda nada, porque quase toda questão
          sorteada já vai ser inédita. Só passa a valer quando a cobertura
          avança e escolher o inédito começa a exigir esforço do sorteio. */}
      {ineditasNasEscolhidas > 0 && cobertas / totalNasEscolhidas >= 0.2 && (
        <button
          onClick={() => setSoIneditas((v) => !v)}
          aria-pressed={soIneditas}
          className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
            soIneditas
              ? "border-slate-900 dark:border-slate-100"
              : "border-borda-controle hover:border-slate-500 dark:hover:border-slate-400"
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
      <div className="sticky bottom-0 z-30 -mx-4 border-t border-borda bg-[var(--background)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
        <button
          onClick={() =>
            onIniciar(escolhas, limite, classe, cronometrar, cego, soIneditas)
          }
          className="w-full rounded-xl bg-slate-900 px-6 py-4 text-base font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
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
          className="group rounded-xl border-2 border-slate-300 px-4 py-3 text-left transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:hover:border-slate-500"
        >
          <div className="font-semibold">
            Revisar erros
            {errosAbertos > 0 && (
              <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                {errosAbertos}
              </span>
            )}
          </div>
          {/* Desabilitado, esta linha é a ÚNICA coisa que o botão tem a dizer
              — é ela que explica por que ele está apagado. Sob a opacidade do
              estado, o cinza de apoio caía para 2,26:1; sem ele, sobe para os
              mesmos 4,63:1 do título. */}
          <div className="mt-0.5 text-sm text-slate-500 group-disabled:text-[color:var(--foreground)] dark:text-slate-400">
            {errosAbertos === 0
              ? "Nenhum erro em aberto — errou, aparece aqui."
              : errosAbertos > LOTE_REVISAO
                ? // O tamanho da sessão dito antes de começar: sem isto, o
                  // selo com 91 promete uma hora de leitura de explicações.
                  // E quantos estão vencidos, porque é o que decide se a
                  // revisão é para hoje: o lote sai deles primeiro.
                  `Os ${LOTE_REVISAO} mais urgentes de ${errosAbertos}${vencidos > 0 ? `, dos quais ${vencidos} sem rever há ${DIAS_PARA_VENCER} dias ou mais` : ", começando pelos mais esquecidos"}.`
                : vencidos > 0
                  ? `${vencidos} de ${errosAbertos} sem rever há ${DIAS_PARA_VENCER} dias ou mais.`
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
  return <h2 className="rotulo-secao mb-2">{children}</h2>;
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
          ? "border-slate-900 bg-rebaixado font-semibold dark:border-slate-100"
          : "border-borda-controle hover:border-slate-500 dark:hover:border-slate-400"
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
      aria-pressed={ativo}
      className={`rounded-xl border-2 p-4 text-left transition ${classes} ${
        // Sem `ring`: o anel repetia a forma do anel de foco do teclado, e a
        // matéria escolhida virava um alvo de tiro — borda colorida, vão
        // branco e anel preto. A seleção agora é o fundo do próprio tema mais
        // a caixa marcada, que é o que diz "dá para marcar mais de uma".
        ativo ? "border-current" : "hover:bg-current/5"
      }`}
    >
      {/* A caixa de seleção é o que diz "pode marcar mais de uma": os cartões
          de matéria têm a mesma cara dos de classe, logo acima, que são
          escolha única — e nada além do link "todas as 3", em letra miúda no
          canto oposto, contava que dá para somar matérias. O quadrado é
          deliberado: o regime, que é escolha única, usa disco. */}
      <div className="flex items-center gap-2 font-semibold">
        <span
          aria-hidden
          className={`grid h-4 w-4 shrink-0 place-items-center rounded border-2 ${
            ativo
              ? "border-current bg-current"
              : "border-slate-400 dark:border-slate-600"
          }`}
        >
          {ativo && (
            <svg
              viewBox="0 0 12 12"
              className="h-3 w-3 text-[var(--background)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.5 6.5 5 9l4.5-5.5" />
            </svg>
          )}
        </span>
        {titulo}
      </div>
      {/* slate-600 e não -500: sobre o fundo tinto da matéria escolhida
          (`bg-sky-50` e companhia) o -500 media 4,47:1 — passava sobre o fundo
          da página e reprovava dentro do cartão selecionado. */}
      <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
        {detalhe}
      </div>
    </button>
  );
}
