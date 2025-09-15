import { surrealdbNodeEngines } from "@surrealdb/node";
import { runAdapterTest } from "better-auth/adapters/test";
import { describe, expect, test } from "vitest";
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

  describe("count", () => {
    test("should count the number of records", async () => {
      const testAdater = adapter({});
      const count = await testAdater.count({
        model: "user",
        where: [],
      });
      console.log(count);
    });
  });
});
