import { pdfjs } from "react-pdf";

/**
 * O worker é servido pelo próprio site, e não por CDN: assim os visualizadores
 * funcionam offline e não dependem de terceiros. O arquivo é publicado em
 * public/ por scripts/preparar_worker.mjs, antes de `dev` e de `build`.
 *
 * Mora num módulo só porque são dois os leitores de PDF — o modal de consulta
 * do simulado e o painel da conferência — e um caminho que valesse num e não no
 * outro daria erro só na tela que ninguém abriu ainda.
 */
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
