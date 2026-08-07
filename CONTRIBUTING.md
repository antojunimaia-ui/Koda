# Contributing to Koda

Thanks for your interest in contributing! A few things to keep in mind:

- **TypeScript only** — avoid `any`. If you must, leave a comment explaining why.
- **One thing per PR** — keep changes focused. Large PRs are hard to review.
- **No placeholders** — deliver complete, working code. No `// TODO` stubs.
- **Never commit secrets** — `.env` is gitignored, keep it that way.
- **Read the code first** — the project is well-structured; find the right place before adding new files.

## Setup

- **Node.js**: Requires Node.js 22 LTS (matching CI build workflow).

```bash
git clone https://github.com/antojunimaia-ui/Koda.git
cd Koda
npm install
cp .env.example .env
npm run dev
```

## Security & Dependencies

- **Security Audits**: Run `npm audit` periodically to inspect dependencies for vulnerabilities.
- **Native Modules**: Exercise caution when using `npm audit fix` to avoid breaking Electron native C/C++ modules (such as `node-pty`). Test native modules with `npm run build` / `npm run postinstall` after updating dependencies.
- **Overrides**: Use `overrides` in `package.json` for transitive dependencies that cannot be updated directly.

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.

## Questions

Open an [issue](https://github.com/antojunimaia-ui/Koda/issues) or discuss on the PR directly.

