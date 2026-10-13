// Checks every file git tracks for things that must never be committed:
// real logins typed into test scripts, API keys, private keys, key stores.
//
//   npm run check:repo
//
// Why this exists: this repository is public, and a folder of throwaway
// browser scripts (.tmp-test/) was once committed with the passwords of
// three real accounts in it, one of them the admin. `check:secrets` only
// looks at the built app; this looks at the source.
//
// It reads file contents only to match the patterns below, and prints the
// file and line number of a match, never the secret itself.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);

// Never allowed in the repository at all, whatever they contain.
const FORBIDDEN_PATHS = [
  [/(^|\/)\.env(\.(?!example$|test\.local\.example$)[^/]*)?$/, "an environment file"],
  [/\.(keystore|jks|p12|pfx|pem)$/i, "a key store or private key file"],
  [/(^|\/)\.tmp-test\//, "a scratch test script (the folder that once held real passwords)"],
  [/(^|\/)assetlinks\.json\.bak$/, "a backup of signing details"]
];

// Shapes of real credentials. The mocked tests use obviously fake values
// (`farmer-pass`, `secret123`), which is why only these files may type a
// literal password at all.
const MOCK_FILES = /^tests\/(e2e|unit)\//;
const CONTENT = [
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "a private key", () => true],
  [/AIza[0-9A-Za-z_-]{35}/, "a Google API key", (m) => !/not-a-real-key/.test(m)],
  [/sb_secret_[A-Za-z0-9_-]{20,}/, "a Supabase secret key", () => true],
  [/eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, "a signed token (possibly a service-role key)", (m) => {
    try { return JSON.parse(Buffer.from(m.split(".")[1], "base64url").toString()).role === "service_role"; } catch { return false; }
  }],
  // a literal typed into a password field, or passed where a login helper expects a password
  [/fill\([^)\n]*password[^)\n]*,\s*(["'])(?!\s*\1)[^"'\n$]{6,}\1\s*\)/i, "a password typed into a login form", (m, file) => !MOCK_FILES.test(file)],
  [/login(?:As)?\([^)\n]*(["'])[^"'\n]+@[^"'\n]+\1\s*,\s*(["'])[^"'\n$]{6,}\2/i, "an email and password passed to a login helper", (m, file) => !MOCK_FILES.test(file)]
];

const problems = [];
for (const file of tracked) {
  for (const [pattern, what] of FORBIDDEN_PATHS) {
    if (pattern.test(file)) problems.push(`${file}: ${what} is tracked by git`);
  }
  if (/\.(png|jpe?g|webp|gif|ico|svg|woff2?|pdf)$/i.test(file) || file === "package-lock.json") continue;
  let text;
  try { text = readFileSync(path.join(root, file), "utf8"); } catch { continue; }
  if (text.includes("\u0000")) continue;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [pattern, what, isReal] of CONTENT) {
      const match = pattern.exec(line);
      if (match && isReal(match[0], file)) problems.push(`${file}:${index + 1}: ${what}`);
    }
  });
}

if (problems.length) {
  console.error(`Found ${problems.length} thing(s) that must not be in the repository:\n`);
  for (const problem of problems) console.error("  " + problem);
  console.error("\nRemove them, and treat any real credential as leaked: change it. Deleting the file does not remove it from git history.");
  process.exit(1);
}
console.log(`Repository check: ${tracked.length} tracked files, no credentials or key files found.`);
