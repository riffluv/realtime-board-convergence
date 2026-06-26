# Contributing

Thanks for considering a contribution.

This package is intentionally small. Changes should keep the core:

- framework-agnostic
- transport-agnostic
- deterministic
- covered by tests

Before opening a pull request, run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm test:sim
pnpm examples:basic
pnpm examples:scheduler
pnpm examples:guard
pnpm examples:convergence
pnpm build
pnpm packcheck
```

Please include a minimal reproduction for convergence bugs.
