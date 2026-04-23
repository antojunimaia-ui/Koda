import https from "https";
import http from "http";
import { gunzipSync, inflateSync } from "zlib";
import { BaseTool, ToolParameter, ToolResult } from "./base.js";

export class WebFetchTool extends BaseTool {
  name = "web_fetch";
  description =
    "Fetch the text content of a URL. Use this after web_search to read the full content of a specific page. Extracts readable text from HTML, stripping scripts, styles, and navigation. Ideal for reading documentation, articles, or API references found via search.";
  parameters: ToolParameter[] = [
    {
      name: "url",
      type: "string",
      description: "The full URL to fetch (e.g., 'https://docs.example.com/api')",
      required: true,
    },
    {
      name: "max_length",
      type: "number",
      description: "Max characters to return. Default: 8000.",
      required: false,
    },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const url = args.url as string;
    const maxLength = (args.max_length as number) || 8000;

    if (!url) return this.failure("URL is required");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return this.failure("URL must start with http:// or https://");
    }

    this.onProgress?.("running", { content: `Fetching: ${url}` });

    try {
      const html = await this.fetchUrl(url);
      const text = this.extractText(html);
      const trimmed = text.length > maxLength ? text.slice(0, maxLength) + "\n\n[... content truncated ...]" : text;

      return this.success(`📄 Content from ${url}:\n\n${trimmed}`);
    } catch (err) {
      return this.failure(`Failed to fetch ${url}: ${(err as Error).message}`);
    }
  }

  private fetchUrl(url: string, redirectCount = 0): Promise<string> {
    if (redirectCount > 5) throw new Error("Too many redirects");

    return new Promise((resolve, reject) => {
      const isHttps = url.startsWith("https://");
      const lib = isHttps ? https : http;

      const options = {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          "Connection": "keep-alive",
        },
        timeout: 15000,
      };

      const req = lib.get(url, options, (res) => {
        // Follow redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let redirectUrl = res.headers.location;
          if (redirectUrl.startsWith("/")) {
            const parsed = new URL(url);
            redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
          }
          res.resume();
          resolve(this.fetchUrl(redirectUrl, redirectCount + 1));
          return;
        }

        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          try {
            let raw = Buffer.concat(chunks);
            const enc = res.headers["content-encoding"];
            if (enc === "gzip") raw = gunzipSync(raw);
            else if (enc === "deflate") raw = inflateSync(raw);
            resolve(raw.toString("utf-8"));
          } catch (e) {
            reject(e);
          }
        });
        res.on("error", reject);
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timed out"));
      });
    });
  }

  private extractText(html: string): string {
    // Remove entire script, style, nav, header, footer, aside blocks
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<aside[\s\S]*?<\/aside>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "");

    // Convert block elements to newlines for readability
    text = text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/td>/gi, "\t")
      .replace(/<\/th>/gi, "\t");

    // Strip remaining tags
    text = text.replace(/<[^>]+>/g, "");

    // Decode HTML entities
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/");

    // Collapse excessive whitespace/blank lines
    text = text
      .replace(/\t+/g, " ")
      .replace(/ +/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return text;
  }
}
