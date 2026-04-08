# Contributing to Koda

Obrigado pelo interesse em contribuir. Leia as diretrizes abaixo antes de abrir PRs.

---

## Princípios

- **TypeScript rigoroso** — evite `any`. Se precisar contornar o tipo, deixe um comentário explicando o porquê.
- **UI consistente** — use as classes Tailwind já existentes. Não invente padrões novos sem discussão.
- **Mudanças focadas** — um PR deve resolver uma coisa. PRs gigantes dificultam review e aumentam chance de conflito.

---

## Setup

```bash
git clone <https://github.com/antojunimaia-ui/Koda.git>
cd Koda
npm install
cp .env.example .env   # preencha suas chaves
npm run dev
```

---

## Convenções de commit

Use [Conventional Commits](https://www.conventionalcommits.org/):

feat: descrição curta
fix: descrição curta
chore: descrição curta
docs: descrição curta

---

## Adicionando ferramentas ao agente

Novas ferramentas precisam:

1. Estar integradas ao sistema de planos do agente
2. Tratar erros explicitamente — nunca deixar falhar silenciosamente
3. Ser documentadas no próprio código (JSDoc mínimo)

---

## Segurança

- **Nunca** commite chaves de API ou secrets — verifique se `.env` está no `.gitignore`
- Ferramentas que acessam o filesystem ou rede precisam de validação de input
- Em caso de dúvida, abre uma issue antes de implementar

---

## Dúvidas

Abra uma [issue](https://github.com/antojunimaia-ui/Koda/issues) ou discuta na PR diretamente.
