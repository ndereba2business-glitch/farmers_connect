// Runs supabase/tests/security.sql against the linked Supabase project and
// reports the result. The SQL always rolls back; its final error message
// carries "SECURITY_TESTS passed=N failed=M :: details".
//
//   npm run test:security
//
// Needs the Supabase CLI, logged in and linked to the project.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Run from the repo root with a relative path: on Windows the CLI goes
// through the shell, which would split a path containing spaces.
const root = fileURLToPath(new URL("..", import.meta.url));
const run = spawnSync("supabase", ["db", "query", "--linked", "-f", "supabase/tests/security.sql"], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32"
});

const output = `${run.stdout || ""}\n${run.stderr || ""}`.replace(/\\n/g, "\n");
const match = /SECURITY_TESTS passed=(\d+) failed=(\d+) :: ([^"\n]*)/.exec(output);

if (!match) {
  console.error("Could not read the security test results. Output was:\n" + output.slice(0, 2000));
  process.exit(2);
}

const [, passed, failed, details] = match;
console.log(`Security checks: ${passed} passed, ${failed} failed`);
if (Number(failed) > 0) {
  for (const line of details.split(";").map(s => s.trim()).filter(Boolean)) console.error("  " + line);
  process.exit(1);
}
console.log("  " + details.trim());
