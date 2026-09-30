import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Disponibiliza o .env para o código de servidor (process.env) em desenvolvimento.
  // Variáveis já definidas no ambiente, como as do docker-compose, têm prioridade.
  Object.assign(process.env, { ...loadEnv(mode, process.cwd(), ""), ...process.env });

  return {
    plugins: [reactRouter()],
    resolve: {
      tsconfigPaths: true,
    },
    server: {
      // "web" é o nome do serviço no compose, usado pelos testes de navegador (e2e).
      allowedHosts: ["web"],
      // Em volumes montados no Windows/Docker os eventos de arquivo não chegam ao container.
      watch: process.env.WATCH_POLLING === "true" ? { usePolling: true, interval: 300 } : undefined,
    },
  };
});
