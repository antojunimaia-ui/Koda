import { Agent } from "./node_modules/operantid.js/src/index.js";

// Recebe os argumentos via stdin para evitar problemas de escape de shell
process.stdin.on("data", async (data) => {
  try {
    let { api_key, provider, model, headless, url, task } = JSON.parse(data.toString());

    // Mapeia 'google' para 'gemini' se necessário, pois o Agent espera 'gemini'
    if (provider === "google") {
      provider = "gemini";
    }

    const agent = new Agent({
      api_key,
      provider,
      model,
      headless
    });

    const fullTask = `Acesse o site: ${url}\n\nApós carregar o site, cumpra a seguinte missão:\n${task}`;
    const result = await agent.execute(fullTask);
    
    process.stdout.write(typeof result === "string" ? result : JSON.stringify(result));
    process.exit(0);
  } catch (err) {
    process.stderr.write(err.message);
    process.exit(1);
  }
});
