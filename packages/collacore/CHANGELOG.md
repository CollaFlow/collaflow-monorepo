# @collaflow/collacore

## 0.1.0

### Minor Changes

- Initialize CollaCore with Fastify-based room management and Yjs collaboration support.

  Features:

  - Fastify server with WebSocket support
  - Redis-backed message bus for cross-instance broadcasting
  - Room lifecycle management (join, leave, auto-destroy)
  - WebSocket message protocol for Yjs document and awareness updates
  - In-memory message bus for testing
