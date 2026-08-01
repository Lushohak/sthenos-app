import { execFileSync } from "node:child_process";
import path from "node:path";

function parseEnvironment(output: string) {
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => {
        const value = match[2].replace(/^"|"$/g, "");
        return [match[1], value];
      })
  );
}

function isLocalUrl(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

export function applyLocalSupabaseEnvironment() {
  const cliPath = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "supabase.cmd" : "supabase"
  );

  let values: Record<string, string>;

  try {
    values = parseEnvironment(
      execFileSync(cliPath, ["status", "-o", "env"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      })
    );
  } catch {
    throw new Error(
      "The local Supabase stack is not running. Start Docker Desktop, then run `npm run supabase:start`."
    );
  }

  const apiUrl = values.API_URL;
  const publicKey = values.PUBLISHABLE_KEY ?? values.ANON_KEY;
  const serviceRoleKey = values.SECRET_KEY ?? values.SERVICE_ROLE_KEY;
  const mailpitUrl = values.MAILPIT_URL ?? values.INBUCKET_URL;

  if (!apiUrl || !isLocalUrl(apiUrl)) {
    throw new Error(
      "End-to-end tests are blocked because Supabase is not running on localhost."
    );
  }

  if (!publicKey || !serviceRoleKey) {
    throw new Error("Unable to read the local Supabase API keys.");
  }

  process.env.NEXT_PUBLIC_SUPABASE_URL = apiUrl;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publicKey;
  process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:3100";
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  process.env.E2E_MAILPIT_URL = mailpitUrl ?? "http://127.0.0.1:54324";
}
