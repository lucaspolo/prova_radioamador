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

const TEMAS: { valor: PreferenciaTema; rotulo: string }[] = [
  { valor: "claro", rotulo: "Claro" },
  { valor: "escuro", rotulo: "Escuro" },
  { valor: "automatico", rotulo: "Automático" },
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
    gravarPreferencias(novo);
    aplicarPreferencias(novo);
  }

  return (
    // Empilhado, e não em linha: o painel do menu tem ~20rem e este é o
    // controle de tamanho de fonte — desenhá-lo com o menor tipo do app e
    // alvos de toque miúdos seria contradizer o que ele faz.
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-500 dark:text-slate-400">Tema</span>
        <div className="flex gap-1">
          {TEMAS.map((t) => (
            <Opcao
              key={t.valor}
              ativa={carregado && prefs.tema === t.valor}
              onClick={() => trocar({ tema: t.valor })}
              rotulo={t.rotulo}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-500 dark:text-slate-400">Texto</span>
        <div className="flex gap-1">
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
      className={`rounded-lg border px-3 py-2 font-medium transition ${
        ativa
          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
          : "border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300"
      }`}
    >
      {rotulo}
    </button>
  );
}
