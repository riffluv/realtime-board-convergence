# Contributing

Thanks for considering a contribution.

This package is intentionally small. Changes should keep the core:

- framework-agnostic
- transport-agnostic
- deterministic
- covered by tests

Before opening a pull request, run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Please include a minimal reproduction for convergence bugs.
