// Checks the production build for leaked secrets.
//
//   npm run check:secrets      (builds first, then runs this)
//
// Fails if dist/ contains:
//   - a Supabase service-role key (a JWT whose payload has role service_role)
//   - the value of any .env variable other than the two meant to be public
//     (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)
// Warns about VITE_-prefixed variables whose names look secret: Vite
// publishes every VITE_ variable the code reads to every visitor.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const PUBLIC_VARS = new Set(["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]);

if (!existsSync(dist)) {
  console.error("dist/ not found. Run `npm run build` first (or use `npm run check:secrets`).");
  process.exit(2);
}

function files(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

function readEnv(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8").split(/\r?\n/)
      .map(line => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.replace(/^["']|["']$/g, "")])
  );
}

function jwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return payload.role;
  } catch {
    return null;
  }
}

const problems = [];
const warnings = [];
const env = { ...readEnv(join(root, ".env")), ...readEnv(join(root, ".env.local")), ...readEnv(join(root, ".env.production")) };
const secretValues = Object.entries(env).filter(([key, value]) => !PUBLIC_VARS.has(key) && value.length >= 8);

for (const [key] of Object.entries(env)) {
  if (key.startsWith("VITE_") && !PUBLIC_VARS.has(key) && /KEY|SECRET|TOKEN|PASSWORD/i.test(key)) {
    warnings.push(`${key} is VITE_-prefixed, so it would be published to the browser if any code read it. ` +
      "Keep server-only secrets without the VITE_ prefix (for example as Supabase function secrets).");
  }
}

const jwtPattern = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
for (const file of files(dist)) {
  const text = readFileSync(file, "utf8");
  const rel = file.slice(root.length);
  for (const token of text.match(jwtPattern) || []) {
    if (jwtRole(token) === "service_role") problems.push(`${rel}: contains a Supabase service-role key`);
  }
  for (const [key, value] of secretValues) {
    if (text.includes(value)) problems.push(`${rel}: contains the value of ${key}`);
  }
}

for (const w of warnings) console.warn("warning: " + w);
if (problems.length) {
  for (const p of problems) console.error("LEAK: " + p);
  process.exit(1);
}
console.log(`No secrets found in dist/ (${files(dist).length} files checked, ${secretValues.length} private .env values looked for).`);
