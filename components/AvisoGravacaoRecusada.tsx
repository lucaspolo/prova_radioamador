/**
 * Aviso de que o navegador recusou gravar o histórico (modo privado, cota
 * cheia). O mesmo caso que a conferência trata com `storageRecusou`; aqui o
 * texto diz o que ainda dá para fazer — o resultado vive no estado desta aba,
 * então exportar o histórico antes de fechar salva tudo, inclusive ele.
 *
 * Componente próprio porque o aviso aparece em duas telas de resultado
 * (bateria avulsa e prova completa), e a frase precisa ser a mesma nas duas.
 */
export default function AvisoGravacaoRecusada() {
  return (
    <div
      role="alert"
      className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <span className="font-semibold">Este resultado não foi salvo.</span> O
      navegador recusou gravar — modo privado ou armazenamento cheio. Ele vale
      só nesta aba: antes de fechar, exporte o histórico na tela de desempenho
      para não o perder.
    </div>
  );
}
