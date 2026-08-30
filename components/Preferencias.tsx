"use client";

import { useEffect, useState } from "react";
import {
  aplicarPreferencias,
  gravarPreferencias,
  lerPreferencias,
  PREFERENCIAS_PADRAO,
  type Escala,
  type PreferenciaTema,
  type Preferencias as Prefs,
} from "@/lib/preferencias";

/**
 * `\u00ad` é um hífen condicional: invisível quando a palavra cabe, vira
 * "Automá-tico" em duas linhas quando não cabe. Numa tela de 320 px com a
 * fonte em 1,15 a célula tem 78 px e a palavra pede 94 — e é justamente a
 * palavra que a pessoa precisa ler para escolher. `hyphens: auto` dependeria
 * do dicionário do navegador (o Chrome sem ele não quebrava nada); o hífen
 * condicional funciona em todos. Encurtar para "Auto" resolveria a largura
 * escondendo o que o botão faz.
 */
const TEMAS: { valor: PreferenciaTema; rotulo: string; nome: string }[] = [
  { valor: "claro", rotulo: "Claro", nome: "Claro" },
  { valor: "escuro", rotulo: "Escuro", nome: "Escuro" },
  { valor: "automatico", rotulo: "Autom\u00adático", nome: "Automático" },
];

const ESCALAS: { valor: Escala; rotulo: string }[] = [
  { valor: "pequeno", rotulo: "A−" },
  { valor: "normal", rotulo: "A" },
  { valor: "grande", rotulo: "A+" },
];

/**
 * Tema e tamanho de texto.
 *
 * O tema seguia só o sistema, sem escolha: quem estuda de madrugada no celular
 * com o aparelho no claro não tinha saída. O tamanho de texto vale pelo mesmo
 * motivo — o app é lido em telefone, em sessões longas.
 *
 * O estado só é lido do storage dentro do efeito, como em `useHistorico`: no
 * export estático, ler `localStorage` durante o render divergiria do HTML
 * gerado na build.
 */
export default function Preferencias() {
  const [prefs, setPrefs] = useState<Prefs>(PREFERENCIAS_PADRAO);
  const [carregado, setCarregado] = useState(false);
  const [recusou, setRecusou] = useState(false);

  useEffect(() => {
    // Mesmo padrão de hidratação de `useHistorico`: o storage só existe no
    // cliente, e ler durante o render divergiria do HTML da build. O script
    // anti-flash do layout já aplicou o tema antes da primeira pintura — aqui
    // é só para os botões saberem qual está ativo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(lerPreferencias());
    setCarregado(true);
  }, []);

  function trocar(mudanca: Partial<Prefs>) {
    const novo = { ...prefs, ...mudanca };
    setPrefs(novo);
    // Recusa (modo privado, cota) não é silenciosa: a preferência aplica na
    // aba, mas não sobrevive a ela — o aviso diz exatamente isso. Sucesso
    // limpa o aviso, senão ele viraria mentira na primeira gravação aceita.
    setRecusou(!gravarPreferencias(novo));
    aplicarPreferencias(novo);
  }

  return (
    // Empilhado, e não em linha: o painel do menu tem ~20rem e este é o
    // controle de tamanho de fonte — desenhá-lo com o menor tipo do app e
    // alvos de toque miúdos seria contradizer o que ele faz.
    //
    // Cada grupo é uma barra de três células de largura total, com o rótulo
    // ACIMA. Em linha, os três botões não cabiam: numa tela de 320 px o painel
    // ganhava rolagem horizontal e "Automático" chegava cortado em
    // "Automátic" — a palavra que a pessoa precisa ler para escolher. Com
    // fonte grande sobravam 70 px de estouro. A barra também comunica escolha
    // única melhor do que três pílulas soltas.
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <span id="rotulo-tema" className="rotulo-secao">
          Tema
        </span>
        <div
          role="group"
          aria-labelledby="rotulo-tema"
          className="mt-1 grid grid-cols-3 gap-1"
        >
          {TEMAS.map((t) => (
            <Opcao
              key={t.valor}
              ativa={carregado && prefs.tema === t.valor}
              onClick={() => trocar({ tema: t.valor })}
              rotulo={t.rotulo}
              // "Automático" sozinho não diz automático de quê: o rótulo do
              // grupo é um <span>, e leitor de tela nenhum o liga ao botão sem
              // o `aria-labelledby` acima — que só nomeia o GRUPO. E o nome
              // vem sem o hífen condicional, que o leitor soletraria.
              descricao={`Tema ${t.nome.toLowerCase()}`}
            />
          ))}
        </div>
      </div>
      <div>
        <span id="rotulo-texto" className="rotulo-secao">
          Texto
        </span>
        <div
          role="group"
          aria-labelledby="rotulo-texto"
          className="mt-1 grid grid-cols-3 gap-1"
        >
          {ESCALAS.map((e) => (
            <Opcao
              key={e.valor}
              ativa={carregado && prefs.escala === e.valor}
              onClick={() => trocar({ escala: e.valor })}
              rotulo={e.rotulo}
              descricao={`Texto ${e.valor}`}
            />
          ))}
        </div>
      </div>
      {recusou && (
        <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">
          O navegador recusou gravar — a escolha vale só nesta aba.
        </p>
      )}
    </div>
  );
}

function Opcao({
  ativa,
  onClick,
  rotulo,
  descricao,
}: {
  ativa: boolean;
  onClick: () => void;
  rotulo: string;
  descricao?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativa}
      aria-label={descricao}
      // As três células crescem juntas quando um rótulo quebra em duas linhas,
      // então a barra não desalinha.
      className={`alvo-toque w-full min-w-0 justify-center rounded-lg border px-2 py-1 text-center leading-tight font-medium transition ${
        ativa
          ? "border-slate-900 bg-rebaixado font-semibold dark:border-slate-100"
          : "border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300"
      }`}
    >
      {rotulo}
    </button>
  );
}
