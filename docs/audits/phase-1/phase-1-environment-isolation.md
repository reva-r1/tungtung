# Revana Technologies — Phase 1 Environment Isolation Architecture
**Document ID:** `AUDIT-PHASE1-ENV-ISOLATION`  
**Phase:** 1 (Environment Isolation)  
**Status:** IMPLEMENTED & ENFORCED  
**Date:** 2026-10-16  

---

## 1. Environment Boundary Architecture

Revana Technologies enforces strict, deterministic separation across four operational environments:
1. **Production (`production`)**
2. **Local Development (`development`)**
3. **Automated Testing (`test`)**
4. **Isolated Simulation / Benchmark (`simulation`)**

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RUNTIME ENVIRONMENT CHECK                       │
│                       (validateEnvironment hook)                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          ▼                                                   ▼
┌──────────────────┐                                ┌──────────────────┐
│   PRODUCTION     │                                │   DEVELOPMENT /  │
│  (Fail-Closed)   │                                │   TEST / DEMO    │
└─────────┬────────┘                                └─────────┬────────┘
          │                                                   │
          ├─► REVANA_DEMO_MODE=true? ──► [SECURITY FAULT]     ├─► Demo allowed
          ├─► MARITIME_DEMO_MODE=true? ──► [SECURITY FAULT]   ├─► Mock allowed in test
          ├─► Mock Provider? ──► [SECURITY VIOLATION]         └─► Test DB isolation
          ├─► seedDatabase()? ──► [SECURITY VIOLATION]
          └─► DB: aegis_intel.db (Operational Only)
```

---

## 2. Environment Matrix & Enforcement Rules

| Rule / Feature | Production | Local Development | Automated Test | Isolated Demo / Benchmark |
| :--- | :--- | :--- | :--- | :--- |
| **`NODE_ENV` Value** | `production` | `development` | `test` | `development` (with flag) |
| **`REVANA_DEMO_MODE`** | **FORBIDDEN (Throws)** | Allowed (Default: false) | Ignored | Allowed (`true`) |
| **`MARITIME_DEMO_MODE`**| **FORBIDDEN (Throws)** | Allowed (Default: false) | Ignored | Allowed (`true`) |
| **Database Target** | `aegis_intel.db` | `aegis_intel.db` | `test_aegis_intel.db` | Standalone clone |
| **Mock Providers** | **REJECTED (Throws)** | Allowed for debugging | Allowed in isolation | Allowed in isolation |
| **`seedDatabase()`** | **BLOCKED (Throws)** | Allowed via manual flag| Allowed in test DB | Allowed via guarded route |
| **Unconfigured Connector** | Return empty / degraded | Return empty / degraded | Fail-closed validated | May load fixture |

---

## 3. Implementation Details

### 3.1 Environment Validation at Startup (`server/src/config/environment.ts`)
The `validateEnvironment()` function executes prior to route binding and server listening. It inspects `process.env` and enforces:
1. If `NODE_ENV === 'production'` and `REVANA_DEMO_MODE === 'true'`, execution aborts immediately with `[SECURITY FAULT]`.
2. If `NODE_ENV === 'production'` and `MARITIME_DEMO_MODE === 'true'`, execution aborts immediately with `[SECURITY FAULT]`.
3. If `NODE_ENV === 'production'` and `DATABASE_FILE` points to a test database (contains `test_`), execution aborts immediately.

### 3.2 Provider Registry Fail-Closed Defense (`server/src/connectors/registry/ProviderRegistry.ts`)
Even if an unauthorized developer attempts to manually register a mock provider in production code:
```typescript
if (process.env.NODE_ENV === 'production' && provider.category === 'MOCK') {
  throw new Error(`[Security Violation] Mock provider '${provider.id}' cannot be registered in production environment.`);
}
```

### 3.3 Mock Provider Constructor Defense (`server/src/connectors/providers/mock/MockDataProvider.ts`)
Defense-in-depth is enforced at the class instantiation level:
```typescript
if (process.env.NODE_ENV === 'production') {
  throw new Error(`[Security Violation] MockDataProvider '${id}' is strictly forbidden in production mode.`);
}
```

### 3.4 Seed Routine Hardening (`server/src/db/seedData.ts`)
The `seedDatabase()` function throws immediately if invoked in production:
```typescript
if (process.env.NODE_ENV === 'production') {
  throw new Error('[Security Violation] seedDatabase is strictly prohibited in production environments.');
}
```

### 3.5 Automated Test Database Isolation (`server/src/db/database.ts`)
To prevent test suites from polluting the operational database `aegis_intel.db`:
```typescript
const isTestRun = process.env.NODE_ENV === 'test' || Boolean(process.argv[1] && process.argv[1].includes('.test.'));

export const DB_PATH = isTestRun
  ? (process.env.TEST_DATABASE_FILE || path.join(DATA_DIR, 'test_aegis_intel.db'))
  : (process.env.DATABASE_FILE || path.join(DATA_DIR, 'aegis_intel.db'));
```
Whenever `npm run test:connectors` or `phase1_isolation.test.ts` runs, SQLite connections target an isolated sandbox database, ensuring zero operational contamination.

---

## 4. Secret & Credential Sanitization

1. Error messages thrown by missing connectors log standard missing configuration identifiers (e.g., `GTFS_FEED_URL not configured`, `DATA_GOV_API_KEY not configured`) without echoing environment values or tokens.
2. In `server/src/index.ts`, logging verifies API key presence without logging credential values (`hasGroq ? 'API Key Verified & Active' : 'Offline Grounded Mode'`).
3. HTTP error handlers return sanitized messages to clients without stack traces exposing filesystem or credential metadata.
