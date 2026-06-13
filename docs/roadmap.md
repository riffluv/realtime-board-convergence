# Roadmap

This package is intentionally small. The roadmap focuses on convergence
correctness, testability, and integration clarity.

## Near Term

- Add more adversarial simulation seeds.
- Add examples for common UI integrations without depending on a framework.
- Add snapshot diff helpers for diagnostics.
- Add typed trace event helpers for consumers that want structured telemetry.
- Publish a `0.1.0` prerelease once the public API names settle.

## Later

- Add property-based tests for operation ordering.
- Add a browser example that runs locally without a backend.
- Add benchmark scripts for large board sizes.
- Add adapters as separate packages only if repeated integration patterns
  become clear.

## Non-Roadmap

The package will not include rendering, database adapters, authentication,
payment logic, product-specific game rules, or hosted infrastructure.
