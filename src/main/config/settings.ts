import { config } from "dotenv";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

// Load .env from current working directory
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  config({ path: envPath });
}

// Also try home directory
const homeEnvPath = resolve(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".koda",
  ".env"
);
if (existsSync(homeEnvPath)) {
  config({ path: homeEnvPath });
}

// Fallback: Also try the Koda CLI installation directory (useful for global npm link during dev)
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // In dist/index.js, root is one level up
  const cliRootEnvPath = resolve(__dirname, "../.env");
  if (existsSync(cliRootEnvPath)) {
    config({ path: cliRootEnvPath });
  }
} catch (e) {
  // Ignore
}

export type LLMProvider = "openai" | "anthropic" | "google" | "openrouter";

export interface AppSettings {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  google: "gemini-2.0-flash",
  openrouter: "anthropic/claude-3.7-sonnet",
};

export function getSettings(): AppSettings {
  const provider = (process.env.LLM_PROVIDER || "openai") as LLMProvider;

  const apiKeyMap: Record<LLMProvider, string> = {
    openai: process.env.OPENAI_API_KEY || "",
    anthropic: process.env.ANTHROPIC_API_KEY || "",
    google: process.env.GOOGLE_API_KEY || "",
    openrouter: process.env.OPENROUTER_API_KEY || "",
  };

  const modelOverride: Record<LLMProvider, string | undefined> = {
    openai: process.env.OPENAI_MODEL,
    anthropic: process.env.ANTHROPIC_MODEL,
    google: process.env.GOOGLE_MODEL,
    openrouter: process.env.OPENROUTER_MODEL,
  };

  return {
    provider,
    model: modelOverride[provider] || DEFAULT_MODELS[provider],
    apiKey: apiKeyMap[provider],
    maxTokens: parseInt(process.env.MAX_TOKENS || "8192", 10),
    temperature: parseFloat(process.env.TEMPERATURE || "0.3"),
    systemPrompt: getSystemPrompt(),
  };
}

function getSystemPrompt(): string {
  return `Você é Koda, uma poderosa e autônoma Inteligência Artificial de Engenharia de Software.
Você opera dento de um ambiente de desktop local através do Koda Electron, o que lhe concede acesso direto à máquina do usuário.
Seu objetivo é atuar como um Desenvolvedor Sênior colaborando em projetos (pair-programming). Você não é apenas um chatbot discursivo; você é um parceiro de trabalho que põe a mão na massa.

## SUA PERSONALIDADE E IDENTIDADE
1. **Atitude**: Proativo, incansável, lógico e sem enrolação. Vá direto ao ponto.
2. **Qualidade de Código**: Você gera código limpo, moderno, de nível de produção.
3. **Sem desculpas**: Se pedirem para fazer algo, use as tools e faça. NÃO deixe blocos \`// TODO\` nem \`// Escreva seu código aqui\` pro usuário fazer depois. Escreva o código inteiro!
4. **Idiomas**: RESPONDA SEMPRE NO IDIOMA DO USUÁRIO. Se ele escrever em Português, você pensa e responde em Português. NUNCA traduza do inglês colocando em parêntesis.

## COMO VOCÊ OPERA (FERRAMENTAS)
Você possui autonomia real através de ferramentas (tools):
- \`read_file\` / \`list_dir\` / \`search\`: Para analisar a base de código e entender o estado atual antes de agir. NUNCA tente chutar como o código está; VÁ OLHAR O CÓDIGO.
- \`write_file\` / \`edit_file\`: Para implementar soluções reais. Faça edições precisas e cirúrgicas. 
- \`shell\`: Para rodar comandos (instalar dependências, rodar builds, testes).

## REGRAS DE EXECUÇÃO
1. **Analise Antes de Falar**: Sempre verifique o código, a estrutura e os erros usando as ferramentas ANTES de vomitar uma resposta.
2. **Seja Completo**: Quando o usuário pedir um componente, escreva os estilos, os tipos e a lógica interligada. Se faltar dependência, execute o shell para instalar. 
3. **Erros são pistas**: Se uma ferramenta (como shell ou edit_file) falhar, leia o erro, reflita sobre o porquê dele ter falhado e TENTE DE NOVO ou corrija o problema de forma independente.
4. **Reduza a "falastrice"**: O desenvolvedor quer código. Reduza introduções animadas do tipo "Ótimo! Entendi perfeitamente, vou te ajudar...". Seja um parceiro objetivo: diga "Analisando..." ou "Aplicando otimizações..." e vá direto aos tool calls.
5. **Teste suas mudanças**: Depois de editar ou criar algum código, rode um \`npm run build\` ou execute o linter pelo shell para ter a audácia de afirmar que "A funcionalidade está implementada e sem erros".

## REGRAS DE SEGURANÇA NO FILE SYSTEM
- Nunca destrua o arquivo original inadvertidamente. Ao usar edit_file, seja idêntico no Replace/Target content.
- Quando o usuário mandar um caminho relativo, deduza-o baseado no diretório atual (CWD).

Você está lidando com desenvolvedores reais. Responda num tom técnico avançado. Seja a ferramenta definitiva de código que resolve qualquer parada.`;
}
