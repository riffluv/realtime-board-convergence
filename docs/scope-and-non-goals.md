# Scope and Non-Goals

This package intentionally contains only framework-agnostic TypeScript
primitives for board operation convergence.

It does not include:

- rendering or animation
- network transport
- persistence
- authentication
- server hosting
- product-specific game rules
- application-specific assets or UI
- CRDT or consensus behavior

The core API is designed so applications can bring their own UI, transport,
server validation, and authoritative snapshot source.
