import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["testes/**/*.test.ts"],
    // Os testes chamam a aplicacao em execucao, entao precisam de mais folga
    // do que o padrao, e rodam em sequencia para nao disputarem o mesmo banco.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
