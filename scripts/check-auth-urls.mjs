// Checks that sign-in brings people back to the public app.
//
//   npm run check:auth-urls
//   node scripts/check-auth-urls.mjs https://another-address.example
//
// After Google sign-in, Supabase returns people to the address they
// started from only if that address is on the project's allow list
// (Authentication > URL Configuration). Otherwise it silently uses the
// project's Site URL. In October 2026 the Site URL was a Vercel address
// that only the team could open, so farmers who chose "Continue with
// Google" on the public site landed on Vercel's "request access" page.
//
// Read-only. It uses the publishable key from .env, changes nothing and
// prints no keys. It asks Supabase to check a made-up link: the check
// fails, and where Supabase sends the browser next shows what is allowed.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function readEnv(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8").split(/\r?\n/)
      .map(line => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.replace(/^["']|["']$/g, "")])
  );
}

const env = { ...readEnv(join(root, ".env")), ...readEnv(join(root, ".env.local")) };
const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const site = process.argv[2];

if (!supabaseUrl || !anonKey) {
  console.error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be in .env.");
  process.exit(2);
}
if (!site || !/^https?:\/\//.test(site)) {
  console.error("Give the public address of the app, for example: node scripts/check-auth-urls.mjs https://example.vercel.app");
  process.exit(2);
}

const origin = new URL(site).origin;
const headers = { apikey: anonKey };
const problems = [];
const pass = (text) => console.log(`ok    ${text}`);
const fail = (text, fix) => { console.log(`FAIL  ${text}`); problems.push(fix); };

// Where Supabase would send someone who asked to come back to `wanted`.
async function landingFor(wanted) {
  const url = `${supabaseUrl}/auth/v1/verify?token=not-a-real-token&type=magiclink&redirect_to=${encodeURIComponent(wanted)}`;
  const res = await fetch(url, { redirect: "manual", headers });
  const location = res.headers.get("location");
  if (!location) throw new Error(`Supabase answered ${res.status} with no redirect; try again in a few minutes.`);
  return new URL(location).origin;
}

// Can a stranger open this address, or does Vercel ask them to log in?
async function opensForAnyone(address) {
  const res = await fetch(address, { redirect: "manual" });
  return res.status === 200 && !/vercel\.com\/(sso|login)/i.test(res.headers.get("location") || "");
}

try {
  if (await opensForAnyone(`${origin}/`)) pass(`${origin} opens without a Vercel login`);
  else fail(`${origin} does not open for the public`,
    "Vercel > project > Settings > Deployment Protection: make sure the production domain is not protected (Standard Protection leaves it public).");

  const settings = await (await fetch(`${supabaseUrl}/auth/v1/settings`, { headers })).json();
  if (settings?.external?.google === true) pass("Google sign-in is switched on in Supabase");
  else fail("Google sign-in is switched off in Supabase",
    "Supabase > Authentication > Sign In / Providers: enable Google.");

  const returned = await landingFor(`${origin}/`);
  if (returned === origin) pass(`people who start at ${origin} come back to it`);
  else fail(`people who start at ${origin} are sent to ${returned} instead`,
    `Supabase > Authentication > URL Configuration > Redirect URLs: add ${origin}/**`);

  // An address nobody has allowed shows the fallback: the Site URL.
  const siteUrl = await landingFor("https://not-allowed.invalid/");
  if (siteUrl === origin) pass(`Supabase's Site URL is ${origin}`);
  else {
    fail(`Supabase's Site URL is ${siteUrl}, not ${origin}`,
      `Supabase > Authentication > URL Configuration > Site URL: set it to ${origin}`);
    // vercel.json forwards the team's own copy of production to the public
    // address, which hides this mistake for as long as Vercel lets the
    // public reach that copy at all.
    const res = await fetch(`${siteUrl}/`, { redirect: "manual" });
    const forwardsTo = res.headers.get("location") || "";
    if (forwardsTo.startsWith(origin)) console.log(`      for now ${siteUrl} forwards to ${origin}, so people still arrive (vercel.json); fix the setting anyway`);
    else if (res.status !== 200) console.log(`      and ${siteUrl} does not open for the public, so those people are locked out`);
  }
} catch (err) {
  console.error(`Could not finish the check: ${err.message}`);
  process.exit(2);
}

if (problems.length) {
  console.log("\nTo fix:");
  for (const fix of [...new Set(problems)]) console.log(`  - ${fix}`);
  process.exit(1);
}
console.log("\nSign-in returns people to the public app.");
