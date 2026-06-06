#!/usr/bin/env node
import { pathToFileURL } from "node:url";

const DEFAULT_SUBJECT = "SMTP2GO smoke test";
const DEFAULT_TEXT = "SMTP2GO live smoke test from email-sdk-smtp2go.";
const VALID_REGIONS = new Set(["us", "eu"]);

const FLAG_NAMES = new Map([
  ["--from", "from"],
  ["--to", "to"],
  ["--subject", "subject"],
  ["--text", "text"],
  ["--html", "html"],
  ["--region", "region"],
  ["--base-url", "baseUrl"],
]);

const USAGE = `Usage:
  SMTP2GO_API_KEY="api-..." npm run smoke:send -- --from "Acme <hello@example.com>" --to "user@example.com"

Options:
  --from <address>     Sender address. Required.
  --to <address>       Recipient address. Required.
  --subject <text>     Subject. Defaults to "${DEFAULT_SUBJECT}".
  --text <text>        Plain-text body. Defaults to a short smoke-test message.
  --html <html>        HTML body.
  --region <us|eu>     SMTP2GO data-residency region.
  --base-url <url>     Override SMTP2GO API base URL.`;

export function parseSmokeSendArgs(argv, env = process.env) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const name = FLAG_NAMES.get(arg);

    if (!name) {
      return fail(`Unknown option: ${arg}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      return fail(`Missing value for ${arg}.`);
    }

    parsed[name] = value;
    index += 1;
  }

  const apiKey = env.SMTP2GO_API_KEY;
  if (!apiKey) {
    return fail("Missing SMTP2GO_API_KEY environment variable.");
  }
  if (!parsed.from) {
    return fail("Missing required --from address.");
  }
  if (!parsed.to) {
    return fail("Missing required --to address.");
  }
  if (parsed.region && !VALID_REGIONS.has(parsed.region)) {
    return fail("Invalid --region. Expected one of: us, eu.");
  }

  const options = {
    apiKey,
    from: parsed.from,
    to: parsed.to,
    subject: parsed.subject ?? DEFAULT_SUBJECT,
    text: parsed.text ?? DEFAULT_TEXT,
  };

  if (parsed.html) {
    options.html = parsed.html;
  }
  if (parsed.region) {
    options.region = parsed.region;
  }
  if (parsed.baseUrl) {
    options.baseUrl = parsed.baseUrl;
  }

  return { ok: true, options };
}

export async function runSmokeSend(
  argv = process.argv.slice(2),
  env = process.env,
  io = consoleIo(),
  deps = {},
) {
  const parsed = parseSmokeSendArgs(argv, env);
  if (!parsed.ok) {
    io.stderr(`smtp2go smoke send: ${parsed.message}`);
    io.stderr(USAGE);
    return 1;
  }

  try {
    const response = await sendSmokeMessage(parsed.options, deps);
    io.stdout(`provider: ${response.provider}`);
    io.stdout(`id: ${response.id ?? ""}`);
    io.stdout(`messageId: ${response.messageId ?? ""}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`smtp2go smoke send failed: ${message}`);
    return 1;
  }
}

export async function sendSmokeMessage(options, deps = {}) {
  const { createEmailClient, smtp2goPlugin } = await resolveDependencies(deps);
  const pluginOptions = {
    apiKey: options.apiKey,
  };

  if (options.region) {
    pluginOptions.region = options.region;
  }
  if (options.baseUrl) {
    pluginOptions.baseUrl = options.baseUrl;
  }

  const email = createEmailClient({
    plugins: [smtp2goPlugin(pluginOptions)],
  });

  const message = {
    from: options.from,
    to: options.to,
    subject: options.subject,
    text: options.text,
  };

  if (options.html) {
    message.html = options.html;
  }

  return email.send(message);
}

async function resolveDependencies(deps) {
  if (deps.createEmailClient && deps.smtp2goPlugin) {
    return deps;
  }

  const [{ createEmailClient }, { smtp2goPlugin }] = await Promise.all([
    import("@opencoredev/email-sdk"),
    import("../dist/index.js"),
  ]);

  return { createEmailClient, smtp2goPlugin };
}

function fail(message) {
  return { ok: false, message };
}

function consoleIo() {
  return {
    stdout: (line) => console.log(line),
    stderr: (line) => console.error(line),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runSmokeSend();
  process.exitCode = exitCode;
}
