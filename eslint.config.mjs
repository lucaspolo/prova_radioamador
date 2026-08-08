import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Nada aqui é código do projeto, e tudo está no .gitignore. O .venv entra
    // na lista porque as dependências Python do gerador e da auditoria de OCR
    // (torch, mpire) trazem JS minificado junto, e sem isto `npm run lint`
    // reporta milhares de problemas de biblioteca de terceiro.
    ".venv/**",
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
