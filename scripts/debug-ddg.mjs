import https from 'https';
import { gunzipSync } from 'zlib';

const query = "Moonshot AI API base URL";
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
  }
};

const req = https.request(options, (res) => {
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  res.on("end", () => {
    let raw = Buffer.concat(chunks);
    if (res.headers["content-encoding"] === "gzip") raw = gunzipSync(raw);
    const html = raw.toString("utf-8");

    // Test the new parser (matchAll approach)
    const anchorRegex = /<a[^>]+class=['"]result-link['"][^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>|<a[^>]+href=['"]([^'"]+)['"][^>]+class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/gi;

    const results = [];
    let match;
    const matches = [];

    while ((match = anchorRegex.exec(html)) !== null) {
      const url = match[1] || match[3];
      const rawTitle = match[2] || match[4];
      if (url && rawTitle) {
        const title = rawTitle.replace(/<[^>]+>/g, "").trim();
        matches.push({ url, title, afterIdx: match.index + match[0].length });
      }
    }

    console.log("Matches found:", matches.length);

    for (const { url: rawUrl, title, afterIdx } of matches) {
      let url = rawUrl;
      if (url.startsWith("//")) url = "https:" + url;

      const afterHtml = html.slice(afterIdx, afterIdx + 800);
      const snippetMatch = afterHtml.match(/class=['"]result-snippet['"]>([\s\S]*?)<\/td>/i);
      let snippet = snippetMatch
        ? snippetMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
        : "No description.";

      results.push({ title, url, snippet });
      if (results.length >= 5) break;
    }

    console.log("\n--- RESULTS ---");
    results.forEach((r, i) => {
      console.log(`\n${i+1}. ${r.title}`);
      console.log(`   ${r.url}`);
      console.log(`   ${r.snippet.slice(0, 100)}`);
    });
  });
});

req.on("error", (e) => console.error("Error:", e));
req.write(postData);
req.end();
