import { inspect } from "node:util";
import { surrealdbNodeEngines } from "@surrealdb/node";
import { betterAuth } from "better-auth";
import { surrealAdapter } from "../../src";

export const auth = betterAuth({
  appName: "SurrealDB Adapter Test",
  emailAndPassword: {
    enabled: true,
  },
  database: surrealAdapter({
    debugLogs: true,
    engines: surrealdbNodeEngines(),
    endpoint: "mem://",
    namespace: "test",
    database: "test",
  }),
});

if (import.meta.main) {
  const email = "test@test.com";
  const password = "Welc0me123.";

  console.log("\n🚀 Signing up new user...");
  const signUp = await auth.api.signUpEmail({
    body: {
      name: "Test User",
      email,
      password,
    },
  });
  console.log("✅ Sign up successful!");
  console.log(
    "📝 User details:",
    inspect(signUp, { colors: true, depth: Infinity }),
  );

  console.log("\n🔑 Attempting sign in...");
  const signIn = await auth.api.signInEmail({
    body: {
      email,
      password,
    },
  });
  console.log("✅ Sign in successful!");
  console.log(
    "🎫 Session details:",
    inspect(signIn, { colors: true, depth: Infinity }),
  );
}
