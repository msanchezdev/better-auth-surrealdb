# better-auth-surrealdb

A SurrealDB adapter for [better-auth](https://github.com/next-auth/better-auth), providing seamless authentication integration with SurrealDB.

## Features

- 🔐 **Full Authentication Support**: Complete integration with better-auth's authentication system
- 🚀 **SurrealDB Native**: Built specifically for SurrealDB with optimized queries
- 📊 **Schema Generation**: Automatic schema generation for better-auth tables
- 🔍 **Advanced Queries**: Support for complex WHERE clauses, sorting, and pagination
- 🛡️ **Type Safety**: Full TypeScript support with comprehensive type definitions
- 🧪 **Tested**: Comprehensive test suite using better-auth's adapter testing framework

## Installation

```bash
bun add better-auth-surrealdb
```

## Quick Start

```typescript
import { betterAuth } from "better-auth";
import { surrealAdapter } from "better-auth-surrealdb";
import { surrealdbNodeEngines } from "@surrealdb/node";

export const auth = betterAuth({
  appName: "My App",
  emailAndPassword: {
    enabled: true,
  },
  database: surrealAdapter({
    endpoint: "ws://localhost:8000",
    namespace: "myapp",
    database: "myapp",
    engines: surrealdbNodeEngines(),
  }),
});
```

## Configuration Options

### SurrealAdapterOptions

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `endpoint` | `string` | ✅ | SurrealDB connection endpoint |
| `namespace` | `string` | ❌ | Database namespace |
| `database` | `string` | ❌ | Database name |
| `engines` | `Engines` | ❌ | SurrealDB engines configuration |
| `debugLogs` | `AdapterDebugLogs` | ❌ | Enable debug logging |
| `usePlural` | `boolean` | ❌ | Use plural table names |

### Connection Examples

**Local SurrealDB:**
```typescript
surrealAdapter({
  endpoint: "ws://localhost:8000",
  namespace: "myapp",
  database: "myapp",
})
```

**In-Memory (for testing):**
```typescript
surrealAdapter({
  endpoint: "mem://",
  namespace: "test",
  database: "test",
  engines: surrealdbNodeEngines(),
})
```

**Cloud SurrealDB:**
```typescript
surrealAdapter({
  endpoint: "wss://your-instance.surrealdb.com",
  namespace: "myapp",
  database: "myapp",
  username: "your-username",
  password: "your-password",
})
```

## Schema Generation

The adapter automatically generates SurrealDB schema definitions for better-auth tables:

```sql
DEFINE TABLE user SCHEMALESS;
DEFINE FIELD name ON TABLE user TYPE string;
DEFINE FIELD email ON TABLE user TYPE string;
DEFINE INDEX userUserUnique ON TABLE user COLUMNS email UNIQUE;
DEFINE FIELD emailVerified ON TABLE user TYPE bool;
DEFINE FIELD image ON TABLE user TYPE option<string>;
DEFINE FIELD createdAt ON TABLE user TYPE datetime;
DEFINE FIELD updatedAt ON TABLE user TYPE datetime;

DEFINE TABLE session SCHEMALESS;
DEFINE FIELD expiresAt ON TABLE session TYPE datetime;
DEFINE FIELD token ON TABLE session TYPE string;
DEFINE INDEX sessionSessionUnique ON TABLE session COLUMNS token UNIQUE;
DEFINE FIELD createdAt ON TABLE session TYPE datetime;
DEFINE FIELD updatedAt ON TABLE session TYPE datetime;
DEFINE FIELD ipAddress ON TABLE session TYPE option<string>;
DEFINE FIELD userAgent ON TABLE session TYPE option<string>;
DEFINE FIELD userId ON TABLE session TYPE record<user>;

DEFINE TABLE account SCHEMALESS;
DEFINE FIELD accountId ON TABLE account TYPE string;
DEFINE FIELD providerId ON TABLE account TYPE string;
DEFINE FIELD userId ON TABLE account TYPE record<user>;
DEFINE FIELD accessToken ON TABLE account TYPE option<string>;
DEFINE FIELD refreshToken ON TABLE account TYPE option<string>;
DEFINE FIELD idToken ON TABLE account TYPE option<string>;
DEFINE FIELD accessTokenExpiresAt ON TABLE account TYPE option<datetime>;
DEFINE FIELD refreshTokenExpiresAt ON TABLE account TYPE option<datetime>;
DEFINE FIELD scope ON TABLE account TYPE option<string>;
DEFINE FIELD password ON TABLE account TYPE option<string>;
DEFINE FIELD createdAt ON TABLE account TYPE datetime;
DEFINE FIELD updatedAt ON TABLE account TYPE datetime;

DEFINE TABLE verification SCHEMALESS;
DEFINE FIELD identifier ON TABLE verification TYPE string;
DEFINE FIELD value ON TABLE verification TYPE string;
DEFINE FIELD expiresAt ON TABLE verification TYPE datetime;
DEFINE FIELD createdAt ON TABLE verification TYPE option<datetime>;
DEFINE FIELD updatedAt ON TABLE verification TYPE option<datetime>;
```

## Supported Operations

The adapter supports all better-auth database operations:

- ✅ **Count**: Count records with WHERE conditions
- ✅ **Find One**: Find single record with WHERE conditions
- ✅ **Find Many**: Find multiple records with pagination and sorting
- ✅ **Create**: Create new records
- ✅ **Update**: Update single record
- ✅ **Update Many**: Update multiple records
- ✅ **Delete**: Delete single record
- ✅ **Delete Many**: Delete multiple records

### Supported Query Operators

- `eq` - Equal
- `ne` - Not equal
- `gt` - Greater than
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `in` - In array
- `starts_with` - String starts with
- `ends_with` - String ends with
- `contains` - String contains

## Development

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js
- SurrealDB instance

### Setup

```bash
# Clone the repository
git clone https://github.com/msanchezdev/better-auth-surrealdb.git
cd better-auth-surrealdb

# Install dependencies
bun install

# Run tests
bun test

# Run linter
bun run lint

# Fix linting issues
bun run lint:fix
```

### Running the Example

```bash
# Navigate to example directory
cd example

# Install dependencies
bun install

# Run the example
bun run index.ts
```

## Testing

The project includes comprehensive tests using better-auth's adapter testing framework:

```typescript
import { surrealdbNodeEngines } from "@surrealdb/node";
import { runAdapterTest } from "better-auth/adapters/test";
import { surrealAdapter } from "better-auth-surrealdb";

describe("SurrealDB Adapter", async () => {
  const adapter = surrealAdapter({
    endpoint: "mem://",
    namespace: "test",
    database: "test",
    engines: surrealdbNodeEngines(),
    debugLogs: {
      isRunningAdapterTests: true,
    },
  });

  await runAdapterTest({
    getAdapter: async (betterAuthOptions = {}) => {
      return adapter(betterAuthOptions);
    },
  });
});
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

This project is licensed under the MIT License.

## Related

- [better-auth](https://github.com/next-auth/better-auth) - The authentication library this adapter is built for
- [SurrealDB](https://surrealdb.com/) - The database this adapter connects to
- [@surrealdb/node](https://github.com/surrealdb/surrealdb.node) - Official SurrealDB Node.js client
