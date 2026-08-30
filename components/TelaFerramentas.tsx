"use client";

import { useEffect, useRef, useState } from "react";
import {
  RST_SEM_FONTE,
  TABELAS,
  type TabelaReferencia,
} from "@/lib/referencia";
import AtalhosDaProva from "./AtalhosDaProva";
import BotaoConsultarMaterial from "./BotaoConsultarMaterial";
import Calculadoras from "./Calculadoras";
import Relampago from "./Relampago";
import Icone from "./Icone";

/**
 * Consulta rápida offline: as tabelas que o radioamador usa a vida toda e as
 * contas que a ementa de Eletrônica cobra.
 *
 * Vive numa etapa da máquina de estados, e não numa rota nova, porque o
 * service worker responde toda navegação com a casca de `/` — um deep link
 * para `/ferramentas` sem rede renderizaria a home. Ficando em `/`, a tela já
 * está pré-cacheada sem nenhuma linha a mais em `scripts/gerar_sw.mjs`.
 *
 * Não há link para cá de dentro de uma bateria, e é de propósito: na prova
 * cega seria cola, e no treino seria distração.
 */
export default function TelaFerramentas({
  onVoltar,
}: {
  onVoltar: () => void;
}) {
  const [aba, setAba] = useState<"tabelas" | "calculadoras" | "relampago">(
    "tabelas",
  );
  const titulo = useRef<HTMLHeadingElement>(null);

  // Chegou-se aqui por um item de menu que sumiu da tela; sem isto o foco
  // volta ao <body> e quem navega por teclado ou leitor recomeça do topo.
  useEffect(() => {
    titulo.current?.focus();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 ref={titulo} tabIndex={-1} className="text-xl font-bold">
          Consulta rápida
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Funciona sem rede, como o resto do app. As tabelas são cópias dos
          documentos oficiais — cada uma diz de qual arquivo e página saiu.
        </p>
      </div>

      {/* `flex-wrap`: a 320 px as três abas somavam 361 px e a página inteira
          rolava de lado; com fonte grande o estouro chegava a 93 px. */}
      <div className="flex flex-wrap gap-2">
        <Aba ativa={aba === "tabelas"} onClick={() => setAba("tabelas")}>
          Tabelas
        </Aba>
        <Aba
          ativa={aba === "calculadoras"}
          onClick={() => setAba("calculadoras")}
        >
          Calculadoras
        </Aba>
        <Aba ativa={aba === "relampago"} onClick={() => setAba("relampago")}>
          Relâmpago
        </Aba>
      </div>

      {aba === "tabelas" && (
        <div className="space-y-4">
          {TABELAS.map((t) => (
            <Tabela key={t.id} tabela={t} />
          ))}
          <SemFonte />
        </div>
      )}
      {aba === "calculadoras" && <Calculadoras />}
      {aba === "relampago" && <Relampago />}

      {/* Fora das abas: atalho não é consulta de tabela, e vale para a tela
          inteira. O pré-download do material saiu daqui para `/estudar`, que é
          onde o material passou a morar — mantê-lo nos dois lugares seria duas
          portas para a mesma coisa. */}
      <AtalhosDaProva />

      <button
        onClick={onVoltar}
        className="w-full rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
      >
        Voltar ao início
      </button>
    </div>
  );
}

function Aba({
  ativa,
  onClick,
  children,
}: {
  ativa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativa}
      // Aba é navegação, não escolha de conteúdo: sublinhado, como em toda
      // barra de abas. A caixa preenchida a fazia disputar atenção com o
      // botão que de fato avança a tarefa.
      className={`alvo-toque rounded-t-lg border-b-2 px-4 text-sm font-semibold transition ${
        ativa
          ? "border-slate-900 dark:border-slate-100"
          : "border-transparent text-texto-2 hover:border-borda-controle"
      }`}
    >
      {children}
    </button>
  );
}

function Tabela({ tabela }: { tabela: TabelaReferencia }) {
  const [aberta, setAberta] = useState(false);
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const linhas = termo
    ? tabela.linhas.filter((l) =>
        l.celulas.some((c) => c.toLowerCase().includes(termo)),
      )
    : tabela.linhas;

  const paginas = tabela.fonte.paginas;
  const rotuloPaginas =
    paginas.length === 1
      ? `página ${paginas[0]}`
      : `páginas ${paginas[0]}–${paginas[paginas.length - 1]}`;

  return (
    <section className="rounded-xl border border-borda bg-superficie">
      <button
        onClick={() => setAberta((a) => !a)}
        aria-expanded={aberta}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span>
          <span className="font-semibold">{tabela.titulo}</span>
          <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">
            {tabela.descricao}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-slate-400">
          <Icone
            nome="seta-baixo"
            className={`h-4 w-4 transition-transform ${aberta ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {aberta && (
        <div className="border-t border-borda p-4">
          {tabela.linhas.length > 12 && (
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar…"
              aria-label={`Filtrar ${tabela.titulo}`}
              className="mb-3 min-h-11 w-full rounded-lg border-2 border-slate-300 bg-transparent px-3 text-sm dark:border-slate-700"
            />
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  {tabela.colunas.map((c) => (
                    <th key={c} className="pb-2 pr-3 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr
                    key={l.celulas.join("|")}
                    className="border-t border-borda"
                  >
                    {l.celulas.map((c, i) => (
                      <td
                        key={i}
                        className={`py-1.5 pr-3 align-top ${
                          i === 0 ? "font-medium" : ""
                        }`}
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {linhas.length === 0 && (
            <p className="py-2 text-sm text-slate-500 dark:text-slate-400">
              Nada encontrado para “{busca}”.
            </p>
          )}

          {tabela.nota && (
            <p className="mt-3 text-xs text-slate-500 italic dark:text-slate-400">
              {tabela.nota}
            </p>
          )}

          <div className="mt-3 border-t border-borda pt-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">Fonte:</span> {tabela.fonte.arquivo}
            <span className="opacity-70">
              {" "}
              · {tabela.fonte.referencia}, {rotuloPaginas}
            </span>
            <div>
              <BotaoConsultarMaterial
                arquivoOrigem={tabela.fonte.arquivo}
                pagina={paginas[0]}
                origem="documento"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * A ausência declarada. Some com este bloco e a próxima pessoa preenche a
 * escala RST de memória — que é exatamente o que este app não faz.
 */
function SemFonte() {
  return (
    <section className="rounded-xl border border-dashed border-borda p-4">
      <h3 className="font-semibold text-slate-500 dark:text-slate-400">
        {RST_SEM_FONTE.titulo}
        {/* Cor própria: herdando o slate-500 do título, o selo media 3,87:1
              sobre o slate-200 do próprio chip. */}
        <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          sem fonte
        </span>
      </h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {RST_SEM_FONTE.motivo} Escrevê-la de memória seria fácil e provavelmente
        daria certo — e é justamente por isso que não se faz: o valor destas
        tabelas está em serem conferíveis contra a fonte.
      </p>
    </section>
  );
}
