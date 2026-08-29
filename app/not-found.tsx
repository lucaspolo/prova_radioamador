import Link from "next/link";

/**
 * A página de endereço inexistente, com a casca do app.
 *
 * Existe porque a 404 padrão do Next é uma linha em inglês, sem cabeçalho,
 * sem tema e sem saída — e ela apareceu para todo mundo que abriu `/estudar`
 * direto, enquanto o host não servia os HTML do export por caminho limpo
 * (`cleanUrls` em `vercel.json`). Corrigido o roteamento, esta tela passa a
 * ser o que sempre deveria ter sido: o endereço errado com o caminho de
 * volta, e não um beco.
 */
export default function NaoEncontrada() {
  return (
    <main
      id="conteudo"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16"
    >
      <p className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        Erro 404
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        Este endereço não existe
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        O link pode ter sido digitado errado ou truncado ao ser copiado. Os dois
        endereços do app são estes:
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/"
          className="rounded-xl border-2 border-slate-300 px-4 py-3 transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
        >
          <span className="block font-semibold">Simulados</span>
          <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-400">
            Escolher a classe e a matéria e começar uma bateria.
          </span>
        </Link>
        <Link
          href="/estudar"
          className="rounded-xl border-2 border-slate-300 px-4 py-3 transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
        >
          <span className="block font-semibold">Material de estudo</span>
          <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-400">
            A ementa oficial da prova e os documentos da Anatel.
          </span>
        </Link>
      </div>
    </main>
  );
}
