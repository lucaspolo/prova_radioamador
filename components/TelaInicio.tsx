"use client";

import { useEffect, useState } from "react";
import type { Classe, Tema } from "@/lib/tipos";
import {
  CLASSES,
  CLASSE_PADRAO,
  COR_TEMA,
  FORMATO,
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
import { gravarPreferencias, lerPreferencias } from "@/lib/preferencias";

interface Props {
  historico: Historico;
  onIniciar: (
    tema: Tema,
    quantidade: number,
    classe: Classe,
    cronometrar: boolean,
    cego: boolean,
    soIneditas: boolean,
  ) => void;
  onProvaCompleta: (classe: Classe) => void;
  onRevisar: (classe: Classe) => void;
  onAssuntos: () => void;
}

export default function TelaInicio({
  historico,
  onIniciar,
  onProvaCompleta,
  onRevisar,
  onAssuntos,
}: Props) {
  const [classe, setClasse] = useState<Classe>(CLASSE_PADRAO);
  const [escolha, setEscolha] = useState<Tema>(TEMAS[0]);
  const formato = FORMATO[classe];
  const [quantidade, setQuantidade] = useState(FORMATO[CLASSE_PADRAO].questoes);
  const [cronometrar, setCronometrar] = useState(true);
  const [cego, setCego] = useState(false);
  const [soIneditas, setSoIneditas] = useState(false);
  const contagem = contarPorTema(classe);
  const total = disponiveis(escolha, classe);
  const opcoes = tamanhos(classe);

  // Não dá para sortear mais questões do que existem no tema escolhido.
  const limite = Math.min(quantidade, total);
  const errosAbertos = questoesParaRevisao(historico, classe).length;
  const ineditasNoTema = questoesIneditas(historico, classe, escolha).length;

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
    const salva = lerPreferencias().classe;
    if (salva !== CLASSE_PADRAO) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      trocarClasse(salva);
    }
  }, []);

  function escolherClasse(nova: Classe) {
    trocarClasse(nova);
    // Mescla por cima do storage atual, e não do estado local: tema e escala
    // pertencem ao painel de preferências, que tem o próprio estado vivo —
    // gravar o objeto daqui apagaria uma escolha feita lá nesta mesma sessão.
    gravarPreferencias({ ...lerPreferencias(), classe: nova });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Classe
        </h2>
        <div className="flex gap-2">
          {CLASSES.map((c) => (
            <button
              key={c}
              onClick={() => escolherClasse(c)}
              className={`flex-1 rounded-xl border-2 px-3 py-3 transition ${
                classe === c
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
              }`}
            >
              <div className="text-base font-bold">Classe {c}</div>
              <div className="mt-0.5 text-xs opacity-70">
                {FORMATO[c].questoes} questões · mín. {FORMATO[c].minimo}
              </div>
            </button>
          ))}
        </div>
        {classe === "C" && (
          <p className="mt-3 text-xs text-slate-500 italic dark:text-slate-400">
            A ementa da Classe C é um subconjunto da Classe B, então o banco
            cobre mais do que cai — há questões de cálculo (código de cores,
            Kirchhoff, associação de resistores) que só são cobradas a partir da
            Classe B.
          </p>
        )}
        {classe === "A" && (
          <p className="mt-3 text-xs text-slate-500 italic dark:text-slate-400">
            Inclui o acréscimo técnico da Classe A em Eletrônica. Legislação e
            Técnica e Ética têm a mesma ementa nas três classes — o que muda é o
            número de questões.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Matéria
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {TEMAS.map((tema) => (
            <BotaoTema
              key={tema}
              ativo={escolha === tema}
              titulo={ROTULO_CURTO[tema]}
              detalhe={`${contagem[tema]} questões`}
              classes={`${COR_TEMA[tema].borda} ${COR_TEMA[tema].texto}`}
              onClick={() => setEscolha(tema)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Quantidade de questões
        </h2>
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
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          A prova da Anatel para a Classe {classe} tem {formato.questoes}{" "}
          questões por matéria, exige {formato.minimo} acertos e dá{" "}
          {formato.minutos} minutos. Cada matéria é uma prova separada — por
          isso o simulado é sempre de uma matéria só.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Como conduzir
        </h2>
        {/* Dois cartões lado a lado, e não um botão que alterna o próprio
            rótulo. Num alternador de um botão só, "Modo treino" tanto pode ser
            o estado atual quanto o que acontece ao clicar — e a descrição do
            regime não escolhido fica invisível, justamente a que faltava para
            decidir. Aqui os dois textos aparecem juntos e um está marcado. */}
        <div
          role="group"
          aria-label="Regime da bateria"
          className="mb-3 grid gap-3 sm:grid-cols-2"
        >
          <BotaoRegime
            ativo={!cego}
            titulo="Modo treino"
            detalhe="Gabarito e explicação a cada questão, na hora — é assim que se aprende o conteúdo."
            onClick={() => setCego(false)}
          />
          <BotaoRegime
            ativo={cego}
            titulo="Modo prova"
            detalhe="Sem gabarito até o fim, como no exame: dá para pular, voltar, trocar a resposta e deixar em branco."
            onClick={() => setCego(true)}
          />
        </div>
        <button
          onClick={() => setCronometrar((c) => !c)}
          aria-pressed={cronometrar}
          className={`w-full rounded-xl border-2 p-4 text-left transition ${
            cronometrar
              ? "border-slate-900 dark:border-slate-100"
              : "border-slate-300 opacity-70 hover:opacity-100 dark:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              {cronometrar ? "Cronômetro ligado" : "Cronômetro desligado"}
            </span>
            {cronometrar && (
              <span className="font-mono text-lg font-bold tabular-nums">
                {Math.round(tempoDaBateria(classe, limite) / 60)} min
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {cronometrar
              ? "No ritmo oficial da prova. Ao esgotar, o que faltar conta como erro — igual à prova real."
              : "Sem limite de tempo; bom para estudar com calma."}
          </p>
        </button>
        {/* Só aparece quando há histórico E resta o que cobrir: sem bateria
            feita tudo é inédito (o toggle seria redundante), e com o tema
            zerado ele não teria o que sortear. */}
        {historico.simulados.length > 0 && ineditasNoTema > 0 && (
          <button
            onClick={() => setSoIneditas((v) => !v)}
            aria-pressed={soIneditas}
            className={`mt-3 w-full rounded-xl border-2 p-4 text-left transition ${
              soIneditas
                ? "border-slate-900 dark:border-slate-100"
                : "border-slate-300 opacity-70 hover:opacity-100 dark:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                {soIneditas ? "Só questões inéditas" : "Priorizar inéditas"}
              </span>
              <span className="font-mono text-lg font-bold tabular-nums">
                {ineditasNoTema}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {!soIneditas
                ? `${ineditasNoTema} questões de ${ROTULO_CURTO[escolha]} que você nunca viu. Ligado, a bateria sai delas primeiro.`
                : ineditasNoTema >= limite
                  ? "A bateria inteira sai do que você ainda não viu."
                  : `Restam só ${ineditasNoTema} inéditas — a bateria completa com questões já vistas.`}
            </p>
          </button>
        )}
      </section>

      <button
        onClick={() =>
          onIniciar(escolha, limite, classe, cronometrar, cego, soIneditas)
        }
        className="w-full rounded-xl bg-slate-900 px-6 py-4 text-base font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Iniciar {cego ? "modo prova" : "modo treino"} · {limite} questões
      </button>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* A prova completa é sempre cronometrada, cega e no formato oficial:
            simular o dia do exame é exatamente o ponto dela. */}
        <button
          onClick={() => onProvaCompleta(classe)}
          className="rounded-xl border-2 border-slate-900 px-4 py-3 text-left transition hover:bg-slate-900/5 dark:border-slate-100 dark:hover:bg-white/5"
        >
          <div className="font-semibold">Prova completa</div>
          <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            As 3 matérias em sequência, {FORMATO[classe].questoes} questões e{" "}
            {FORMATO[classe].minutos} min cada, sem gabarito até o fim — como no
            dia do exame.
          </div>
        </button>
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
              : "Só as questões que você errou e ainda não corrigiu."}
          </div>
        </button>
        <button
          onClick={onAssuntos}
          className="rounded-xl border-2 border-slate-300 px-4 py-3 text-left transition hover:border-slate-400 sm:col-span-2 dark:border-slate-700 dark:hover:border-slate-500"
        >
          <div className="font-semibold">Estudar por assunto</div>
          <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            As seções reais do material — plano de bandas, propagação,
            indicativos — cada uma com sua bateria própria, em modo treino.
          </div>
        </button>
      </div>
    </div>
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
          : "opacity-70 hover:opacity-100"
      }`}
    >
      <div className="font-semibold">{titulo}</div>
      <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        {detalhe}
      </div>
    </button>
  );
}
