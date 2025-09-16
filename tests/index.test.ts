import { surrealdbNodeEngines } from "@surrealdb/node";
import { runAdapterTest } from "better-auth/adapters/test";
import { describe } from "vitest";
import { surrealAdapter } from "../src";

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
