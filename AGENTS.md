# AGENTS.md

## Cursor Cloud specific instructions

This is a **Nuxt 3** single-page application ("Obscuritas Event Patcher") using PrimeVue 4, Tailwind CSS, and Sass.

### Key facts

- **Package manager**: npm (lockfile: `package-lock.json`).
- **No lint/test/typecheck scripts** are configured in `package.json`. There is no ESLint config.
- **No database, no `.env` files, no external services** are required.
- The `postinstall` script runs `nuxt prepare` to generate the `.nuxt` directory (TypeScript types, auto-imports).

### Running the dev server

```bash
npm run dev
```

Starts on `http://localhost:3000`. If you see a 500 error on first load, clear the Nuxt cache (`rm -rf .nuxt`) and restart.

### Building

```bash
npm run build
```

### Standard commands

See `README.md` for the full list of dev/build/preview commands.
