---
name: Client-only ColdChain simulations
description: Product constraint requiring all dashboard data, energy calculations, thermal models, and co-pilot guidance to run locally.
---

Keep ColdChain-Twin fully client-only: no backend endpoints, broker connections, remote model calls, databases, or external APIs. All feeds, calculations, thermal models, and co-pilot behavior must remain browser-local.

**Why:** the user explicitly requested a zero-backend standalone simulator with no external APIs.

**How to apply:** preserve this boundary when adding features; model integrations as local simulation only unless the user explicitly revises this scope.
