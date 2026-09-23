# Koda DevTools

Utility scripts for Koda contributors. No build step required — plain Node.js ESM.

---

## commiter

Analyzes the current `git diff` and generates a [Conventional Commits](https://www.conventionalcommits.org/) message using Mistral AI.

**Usage:**

```bash
node DevTools/commiter.mjs
```

You will be prompted for your Mistral API key (get one at [console.mistral.ai](https://console.mistral.ai)). The key is never stored anywhere.

**How it works:**

1. Runs `git diff --cached` (staged changes). If nothing is staged, falls back to `git diff HEAD`.
2. Sends the diff to `codestral-latest` on the Mistral API.
3. Prints the generated commit message.

**Example output:**

```
────────────────────────────────────────────────────────────
feat(agent): add HyperEdit command and improve doom loop detection

- Add /hyperedit slash command with LLM-coordinated multi-agent parallel editing
- Rewrite doom loop detection using stable stringify and linear signature history
- Register /hyperedit in slash menu and known commands list
────────────────────────────────────────────────────────────
```

---

> Adding a new tool? Drop it here as a `.mjs` file and document it in this README.
