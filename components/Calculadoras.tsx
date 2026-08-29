"use client";

import { useState } from "react";
import {
  analisarNumero,
  comprimentoDeOnda,
  comprimentoPratico,
  dbmParaWatts,
  decodificarResistor,
  frequenciaRessonancia,
  meiaOnda,
  quartoDeOnda,
  reatanciaCapacitiva,
  reatanciaIndutiva,
  resolverOhm,
  wattsParaDbm,
  type CorFaixa,
} from "@/lib/calculos";

/** Duas casas por padrão, com vírgula decimal e sem cauda de zeros. */
function fmt(n: number | null, casas = 2): string {
  if (n === null) return "—";
  const abs = Math.abs(n);
  const texto =
    abs !== 0 && (abs < 0.01 || abs >= 1e7)
      ? n.toExponential(casas)
      : n.toLocaleString("pt-BR", { maximumFractionDigits: casas });
  return texto;
}

/**
 * Campo numérico que aceita o jeito brasileiro de digitar.
 *
 * `type="text"` com `inputMode="decimal"` de propósito: no celular em pt-BR um
 * `type="number"` recusa a vírgula em silêncio — o usuário digita "2,5", nada
 * aparece, e ele conclui que o app está quebrado.
 */
function Campo({
  rotulo,
  unidade,
  valor,
  onChange,
}: {
  rotulo: string;
  unidade: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  const invalido = valor.trim() !== "" && analisarNumero(valor) === null;
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {rotulo} <span className="opacity-70">({unidade})</span>
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalido}
        className={`mt-1 w-full rounded-lg border-2 bg-transparent px-3 py-2 tabular-nums ${
          invalido
            ? "border-rose-500"
            : "border-slate-300 focus:border-slate-500 dark:border-slate-700"
        }`}
      />
      {invalido && (
        <span className="text-xs text-rose-700 dark:text-rose-400">
          número inválido
        </span>
      )}
    </label>
  );
}

function Resultado({ itens }: { itens: [string, string][] }) {
  return (
    <output
      aria-live="polite"
      className="mt-4 grid gap-x-4 gap-y-2 rounded-lg bg-slate-100 p-3 text-sm sm:grid-cols-2 dark:bg-slate-800/60"
    >
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="flex justify-between gap-2">
          <span className="text-slate-500 dark:text-slate-400">{rotulo}</span>
          <span className="font-mono font-semibold tabular-nums">{valor}</span>
        </div>
      ))}
    </output>
  );
}

function Bloco({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-300 p-4 dark:border-slate-700">
      <h3 className="font-semibold">{titulo}</h3>
      <p className="mt-0.5 mb-3 text-sm text-slate-500 dark:text-slate-400">
        {descricao}
      </p>
      {children}
    </section>
  );
}

function Ohm() {
  const [v, setV] = useState("");
  const [i, setI] = useState("");
  const [r, setR] = useState("");
  const [p, setP] = useState("");

  const dado = {
    v: analisarNumero(v) ?? undefined,
    i: analisarNumero(i) ?? undefined,
    r: analisarNumero(r) ?? undefined,
    p: analisarNumero(p) ?? undefined,
  };
  const res = resolverOhm(dado);

  return (
    <Bloco
      titulo="Lei de Ohm e potência"
      descricao="Preencha duas grandezas quaisquer; as outras duas saem."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Campo rotulo="Tensão" unidade="V" valor={v} onChange={setV} />
        <Campo rotulo="Corrente" unidade="A" valor={i} onChange={setI} />
        <Campo rotulo="Resistência" unidade="Ω" valor={r} onChange={setR} />
        <Campo rotulo="Potência" unidade="W" valor={p} onChange={setP} />
      </div>
      <Resultado
        itens={[
          ["Tensão", `${fmt(res?.v ?? null)} V`],
          ["Corrente", `${fmt(res?.i ?? null, 3)} A`],
          ["Resistência", `${fmt(res?.r ?? null)} Ω`],
          ["Potência", `${fmt(res?.p ?? null)} W`],
        ]}
      />
      {res === null && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Faltam dados, ou o par informado não determina o circuito —
          resistência zero com tensão conhecida deixa a corrente indefinida.
        </p>
      )}
    </Bloco>
  );
}

const CORES: { cor: CorFaixa; rotulo: string; amostra: string }[] = [
  { cor: "preto", rotulo: "Preto", amostra: "#000000" },
  { cor: "marrom", rotulo: "Marrom", amostra: "#7a4a10" },
  { cor: "vermelho", rotulo: "Vermelho", amostra: "#d02020" },
  { cor: "laranja", rotulo: "Laranja", amostra: "#f07010" },
  { cor: "amarelo", rotulo: "Amarelo", amostra: "#f5d020" },
  { cor: "verde", rotulo: "Verde", amostra: "#20a050" },
  { cor: "azul", rotulo: "Azul", amostra: "#2060d0" },
  { cor: "violeta", rotulo: "Violeta", amostra: "#8040c0" },
  { cor: "cinza", rotulo: "Cinza", amostra: "#909090" },
  { cor: "branco", rotulo: "Branco", amostra: "#f8f8f8" },
  { cor: "ouro", rotulo: "Ouro", amostra: "#c9a227" },
  { cor: "prata", rotulo: "Prata", amostra: "#c0c0c0" },
  { cor: "nenhuma", rotulo: "Nenhuma", amostra: "transparent" },
];

function SeletorCor({
  rotulo,
  valor,
  onChange,
}: {
  rotulo: string;
  valor: CorFaixa;
  onChange: (c: CorFaixa) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {rotulo}
      </span>
      <span className="mt-1 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-5 w-5 shrink-0 rounded border border-slate-400"
          style={{ background: CORES.find((c) => c.cor === valor)?.amostra }}
        />
        <select
          value={valor}
          onChange={(e) => onChange(e.target.value as CorFaixa)}
          className="w-full rounded-lg border-2 border-slate-300 bg-transparent px-2 py-2 dark:border-slate-700"
        >
          {CORES.map((c) => (
            <option key={c.cor} value={c.cor}>
              {c.rotulo}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function Resistor() {
  const [faixas, setFaixas] = useState<CorFaixa[]>([
    "marrom",
    "preto",
    "vermelho",
    "ouro",
  ]);

  const trocar = (i: number, c: CorFaixa) =>
    setFaixas((anteriores) => anteriores.map((f, j) => (j === i ? c : f)));

  const res = decodificarResistor(faixas);
  const valor =
    res === null
      ? "—"
      : res.ohms >= 1e6
        ? `${fmt(res.ohms / 1e6, 3)} MΩ`
        : res.ohms >= 1e3
          ? `${fmt(res.ohms / 1e3, 3)} kΩ`
          : `${fmt(res.ohms, 2)} Ω`;

  return (
    <Bloco
      titulo="Código de cores de resistores"
      descricao="Quatro faixas: dois dígitos, multiplicador e tolerância."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {["1ª faixa", "2ª faixa", "Multiplicador", "Tolerância"].map(
          (rotulo, i) => (
            <SeletorCor
              key={rotulo}
              rotulo={rotulo}
              valor={faixas[i]}
              onChange={(c) => trocar(i, c)}
            />
          ),
        )}
      </div>
      <Resultado
        itens={[
          ["Resistência", valor],
          [
            "Tolerância",
            res?.tolerancia == null ? "—" : `± ${fmt(res.tolerancia, 2)} %`,
          ],
        ]}
      />
      {res === null && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Ouro, prata e &quot;nenhuma&quot; não valem como dígito nas duas
          primeiras faixas.
        </p>
      )}
    </Bloco>
  );
}

function Onda() {
  const [mhz, setMhz] = useState("14,2");
  const f = analisarNumero(mhz);

  return (
    <Bloco
      titulo="Comprimento de onda e antena"
      descricao="A regra prática que a Cartilha ensina: λ (m) ≈ 300 / f (MHz)."
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Frequência" unidade="MHz" valor={mhz} onChange={setMhz} />
      </div>
      <Resultado
        itens={[
          ["λ (regra prática)", `${fmt(f === null ? null : comprimentoPratico(f), 3)} m`],
          ["λ (c / f)", `${fmt(f === null ? null : comprimentoDeOnda(f * 1e6), 3)} m`],
          ["Dipolo de ½ onda", `${fmt(f === null ? null : meiaOnda(f), 3)} m`],
          ["Vertical de ¼ de onda", `${fmt(f === null ? null : quartoDeOnda(f), 3)} m`],
        ]}
      />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Sem fator de encurtamento: nenhum dos documentos oficiais publicados
        aqui traz um. Fio real precisa de ajuste na prática.
      </p>
    </Bloco>
  );
}

function Decibel() {
  const [w, setW] = useState("100");
  const [dbm, setDbm] = useState("");
  const watts = analisarNumero(w);
  const emDbm = analisarNumero(dbm);

  return (
    <Bloco
      titulo="Potência em dB"
      descricao="Conversão entre watts e dBm. Preencha um dos dois."
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Potência" unidade="W" valor={w} onChange={setW} />
        <Campo rotulo="Potência" unidade="dBm" valor={dbm} onChange={setDbm} />
      </div>
      <Resultado
        itens={[
          ["Em dBm", `${fmt(watts === null ? null : wattsParaDbm(watts), 2)} dBm`],
          ["Em watts", `${fmt(emDbm === null ? null : dbmParaWatts(emDbm), 4)} W`],
        ]}
      />
    </Bloco>
  );
}

function LC() {
  const [uh, setUh] = useState("1");
  const [pf, setPf] = useState("100");
  const l = analisarNumero(uh);
  const c = analisarNumero(pf);
  const henry = l === null ? null : l * 1e-6;
  const farad = c === null ? null : c * 1e-12;
  const f0 =
    henry === null || farad === null ? null : frequenciaRessonancia(henry, farad);

  return (
    <Bloco
      titulo="Ressonância e reatâncias"
      descricao="Circuito LC: a frequência em que XL e XC se igualam."
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Indutância" unidade="µH" valor={uh} onChange={setUh} />
        <Campo rotulo="Capacitância" unidade="pF" valor={pf} onChange={setPf} />
      </div>
      <Resultado
        itens={[
          ["Ressonância", `${fmt(f0 === null ? null : f0 / 1e6, 4)} MHz`],
          [
            "XL = XC na ressonância",
            `${fmt(f0 === null || henry === null ? null : reatanciaIndutiva(f0, henry), 1)} Ω`,
          ],
          [
            "XC em 1 MHz",
            `${fmt(farad === null ? null : reatanciaCapacitiva(1e6, farad), 1)} Ω`,
          ],
          [
            "XL em 1 MHz",
            `${fmt(henry === null ? null : reatanciaIndutiva(1e6, henry), 2)} Ω`,
          ],
        ]}
      />
    </Bloco>
  );
}

export default function Calculadoras() {
  return (
    <div className="space-y-4">
      <Ohm />
      <Resistor />
      <Onda />
      <Decibel />
      <LC />
    </div>
  );
}
