import { inspect } from "node:util";
import { surrealdbNodeEngines } from "@surrealdb/node";
import { betterAuth} from "better-auth";
import { surrealAdapter } from "../../src";
import { admin } from 'better-auth/plugins';
import { parseCookies } from 'better-auth/cookies';

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
  plugins: [
    admin(),
  ]
});

if (import.meta.main) {
  const admin = await auth.api.createUser({
    body: {
      email: "admin@test.com",
      password: "admin",
      name: "Admin",
      role: "admin",
    },
  });
  console.log("✅ Admin created!");

  const email = "user1@test.com";
  const password = "Welc0me123.";

  console.log("\n🚀 Signing up new user...");
  const signUp = await auth.api.signUpEmail({
    body: {
      name: "User 1",
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
  const user1 = await auth.api.signInEmail({
    body: {
      email: "admin@test.com",
      password: "admin",
    },
    returnHeaders: true,
  });
  console.log("✅ Sign in successful!");

  const cookies = parseCookies(user1.headers.get("set-cookie") || "");
  console.log(cookies);
  console.log("\n🔑 Attempting list users...");
  const users = await auth.api.listUsers({
    query: {},
    headers: {
      Cookie: cookies.entries().map(([key, value]) => `${key}=${value}`).toArray().join("; "),
    }
  });
  console.log("✅ List users successful!");
  console.log(users);

  // console.log(
  //   "🎫 Session details:",
  //   inspect(signIn, { colors: true, depth: Infinity }),
  // );


}
