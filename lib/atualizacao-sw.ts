/**
 * Ponte entre o registro do service worker e o aviso de atualização.
 *
 * O registro vive no layout (`RegistroSW`) e não sabe em que tela o app está;
 * o aviso vive na página, que sabe — e é a página quem decide quando mostrar,
 * nunca no meio de uma bateria. Este módulo é o encontro dos dois: o registro
 * anuncia que uma versão nova ficou esperando, quem assina é notificado.
 *
 * O worker novo só assume quando `aplicarAtualizacao()` posta `{tipo:
 * "assumir"}` — o sw.js gerado não chama mais `skipWaiting()` sozinho no
 * install. Assumir sem aviso apagava o cache dos chunks antigos com abas
 * abertas, e um `import()` tardio (o visualizador de PDF é dinâmico) quebrava.
 */
type Ouvinte = () => void;

let esperando: ServiceWorker | null = null;
const ouvintes = new Set<Ouvinte>();

/** Há uma versão nova instalada, esperando o usuário aceitar. */
export function haAtualizacao(): boolean {
  return esperando !== null;
}

export function anunciarEspera(sw: ServiceWorker): void {
  esperando = sw;
  ouvintes.forEach((o) => o());
}

/** Devolve a função que cancela a assinatura. */
export function assinar(o: Ouvinte): () => void {
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
  };
}

/**
 * Pede ao worker esperando que assuma e recarrega quando ele assumir.
 *
 * O reload fica atrás do `controllerchange`, e não num timer: recarregar
 * antes de o novo worker controlar a página serviria a casca velha de novo, e
 * o aviso voltaria como se nada tivesse acontecido.
 */
export function aplicarAtualizacao(): void {
  // `typeof navigator` não basta: o Node moderno define `navigator` global
  // (sem `serviceWorker`), e é nele que os testes rodam. O que interessa é a
  // capacidade, não o objeto.
  if (!esperando) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
    return;
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => {
      window.location.reload();
    },
    { once: true },
  );
  esperando.postMessage({ tipo: "assumir" });
}
