# Niti landing

Public product landing for Niti. The page includes a self-contained interactive
story that demonstrates the vacancy import, evidence-backed Job Match, and
application pipeline without calling the production API.

## Development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run lint
npm test
```

The primary product CTAs lead to `https://useniti.xyz/register` and
`https://useniti.xyz/login`.
