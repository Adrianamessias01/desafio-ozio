import type { Config } from "@react-router/dev/config";

export default {
  // Renderização no servidor: loaders e actions rodam no Node, que é quem fala com a API.
  ssr: true,
} satisfies Config;
