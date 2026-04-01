export function highlightCode(code: string, _language?: string): string {
  // Since we migrated from a raw CLI to Electron, syntax highlighting 
  // is now handled via the UI frontend (highlight.js). We just return the code.
  return code;
}

export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rb: "ruby",
    rs: "rust",
    go: "go",
    java: "java",
    kt: "kotlin",
    cs: "csharp",
    cpp: "cpp",
    c: "c",
    h: "c",
    hpp: "cpp",
    css: "css",
    scss: "scss",
    less: "less",
    html: "html",
    xml: "xml",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    md: "markdown",
    sql: "sql",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    ps1: "powershell",
    dockerfile: "dockerfile",
    docker: "dockerfile",
    makefile: "makefile",
    vue: "html",
    svelte: "html",
  };
  return langMap[ext || ""] || "plaintext";
}
