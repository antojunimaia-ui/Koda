import https from "https";
import { gunzipSync } from "zlib";
import { BaseTool, ToolParameter, ToolResult } from "./base.js";

// web-search.ts v3 — matchAll parser + DDG POST (no CAPTCHA) + DDG Instant Answer API
export class WebSearchTool extends BaseTool {
  name = "web_search";
  description =
    "Search the web using DuckDuckGo. Returns summarized results about the query. Use it to find latest information, documentation, package versions, or general facts from the internet.";
  parameters: ToolParameter[] = [
    {
      name: "query",
      type: "string",
      description: "The search query (e.g., 'latest React version', 'how to use Python asyncio')",
      required: true,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const query = args.query as string;
    if (!query) return this.failure("Query is required");

    this.onProgress?.("running", { content: `Searching: "${query}"` });

    try {
      // Layer 1: DDG Instant Answer JSON API — never triggers CAPTCHA, structured data
      console.log("[web_search] Layer 1: fetching instant answer for:", query);
      const instant = await this.fetchInstantAnswer(query);
      console.log("[web_search] Layer 1 result:", instant ? "HAS DATA" : "null");
      if (instant) return this.success(instant);

      // Layer 2: DDG Lite POST endpoint — POST is more resilient than GET vs bot checks
      console.log("[web_search] Layer 2: fetching HTML via POST for:", query);
      const htmlResults = await this.fetchHtmlPost(query);
      console.log("[web_search] Layer 2 result count:", htmlResults.length);
      if (htmlResults.length > 0) {
        const formatted = htmlResults
          .map((r, i) => `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   Snippet: ${r.snippet}`)
          .join("\n\n");
        return this.success(`🌐 Web Search Results for "${query}":\n\n${formatted}`);
      }

      return this.failure(
        `No results found for "${query}". DuckDuckGo may be blocking this request. ` +
        `Try rephrasing the query or use the browser_agent tool for more reliable web access.`
      );
    } catch (err) {
      console.error("[web_search] EXCEPTION:", err);
      return this.failure(`Web search failed: ${(err as Error).message}`);
    }
  }

  /** DDG Instant Answer JSON API — no CAPTCHA, returns structured data */
  private async fetchInstantAnswer(query: string): Promise<string | null> {
    return new Promise((resolve) => {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

      https.get(url, {
        headers: {
          "User-Agent": "Koda-AI/1.0",
          "Accept": "application/json",
        },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          try {
            const body = Buffer.concat(chunks).toString("utf-8");
            const data = JSON.parse(body);
            const lines: string[] = [];

            if (data.AbstractText) {
              lines.push(`📖 **Summary:** ${data.AbstractText}`);
              if (data.AbstractURL) lines.push(`   Source: ${data.AbstractURL}`);
            }

            if (data.Answer) {
              lines.push(`✅ **Direct Answer:** ${data.Answer}`);
            }

            if (data.Results && data.Results.length > 0) {
              lines.push(`\n📋 **Results:**`);
              data.Results.slice(0, 5).forEach((r: any) => {
                lines.push(`- **${r.Text || r.title}**\n  ${r.FirstURL || r.url}`);
              });
            }

            if (data.RelatedTopics && data.RelatedTopics.length > 0) {
              const topics = data.RelatedTopics
                .filter((t: any) => t.Text && t.FirstURL)
                .slice(0, 5);
              if (topics.length > 0) {
                lines.push(`\n🔗 **Related Topics:**`);
                topics.forEach((t: any) => {
                  lines.push(`- ${t.Text}\n  ${t.FirstURL}`);
                });
              }
            }

            if (lines.length === 0) {
              resolve(null);
            } else {
              resolve(`🌐 DuckDuckGo Answer for "${query}":\n\n${lines.join("\n")}`);
            }
          } catch {
            resolve(null);
          }
        });
        res.on("error", () => resolve(null));
      }).on("error", () => resolve(null));
    });
  }

  /** DDG Lite POST endpoint — POST bypasses some bot checks vs GET */
  private async fetchHtmlPost(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
    return new Promise((resolve) => {
      const postData = `q=${encodeURIComponent(query)}&b=&kl=en-us`;
      const options = {
        hostname: "lite.duckduckgo.com",
        path: "/lite/",
        method: "POST",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Lynx/2.9.0dev.8)",
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData),
          "Accept": "text/html",
          "Accept-Encoding": "gzip",
          "Referer": "https://lite.duckduckgo.com/lite/",
          "Origin": "https://lite.duckduckgo.com",
        },
      };

      const req = https.request(options, (res) => {
        console.log("[web_search] POST status:", res.statusCode, "encoding:", res.headers["content-encoding"]);
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          try {
            let raw = Buffer.concat(chunks);
            if (res.headers["content-encoding"] === "gzip") {
              raw = gunzipSync(raw);
            }
            const html = raw.toString("utf-8");
            console.log("[web_search] POST html length:", html.length, "has result-link:", html.includes("result-link"), "has captcha:", html.includes("anomaly-modal"));
            resolve(this.parseHtml(html));
          } catch (e) {
            console.error("[web_search] POST parse error:", e);
            resolve([]);
          }
        });
        res.on("error", (e) => { console.error("[web_search] POST res error:", e); resolve([]); });
      });

      req.on("error", (e) => { console.error("[web_search] POST req error:", e); resolve([]); });
      req.write(postData);
      req.end();
    });
  }

  private parseHtml(html: string): { title: string; url: string; snippet: string }[] {
    const results: { title: string; url: string; snippet: string }[] = [];

    // Match each result-link anchor including its href and text
    // The <a> tag has: rel="nofollow" href="URL" class='result-link'>TITLE</a>
    const anchorRegex = /<a[^>]+class=['"]result-link['"][^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>|<a[^>]+href=['"]([^'"]+)['"][^>]+class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/gi;

    let match;
    const matches: { url: string; title: string; afterIdx: number }[] = [];

    while ((match = anchorRegex.exec(html)) !== null) {
      // Group 1+2 = class before href, Group 3+4 = href before class
      const url = match[1] || match[3];
      const rawTitle = match[2] || match[4];
      if (url && rawTitle) {
        const title = rawTitle.replace(/<[^>]+>/g, "").trim();
        matches.push({ url, title, afterIdx: match.index + match[0].length });
      }
    }

    for (const { url: rawUrl, title, afterIdx } of matches) {
      let url = rawUrl;
      if (url.startsWith("//")) url = "https:" + url;
      if (url.includes("uddg=")) {
        try {
          const encoded = url.split("uddg=")[1]?.split("&")[0];
          if (encoded) url = decodeURIComponent(encoded);
        } catch {}
      }

      // Find the snippet in the HTML after this anchor
      const afterHtml = html.slice(afterIdx, afterIdx + 800);
      const snippetMatch = afterHtml.match(/class=['"]result-snippet['"]>([\s\S]*?)<\/td>/i);
      let snippet = snippetMatch
        ? snippetMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
        : "";

      if (title && url) {
        results.push({ title, url, snippet: snippet || "No description." });
      }

      if (results.length >= 8) break;
    }

    return results;
  }
}
