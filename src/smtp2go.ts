import type {
  EmailMessage,
  EmailProvider,
  EmailProviderContext,
  EmailProviderResponse,
} from "@opencoredev/email-sdk";

/** Adapter slug used to register and select this provider. */
export const SMTP2GO_ADAPTER_SLUG = "smtp2go";

/** Default (global) SMTP2GO API base URL. */
export const SMTP2GO_DEFAULT_BASE_URL = "https://api.smtp2go.com/v3";

/** Path of the SMTP2GO send-email endpoint, relative to the base URL. */
export const SMTP2GO_SEND_ENDPOINT = "/email/send";

/** Regional SMTP2GO API base URLs for data-residency accounts. */
export const SMTP2GO_REGION_BASE_URLS = {
  us: "https://us-api.smtp2go.com/v3",
  eu: "https://eu-api.smtp2go.com/v3",
} as const satisfies Record<string, string>;

/** SMTP2GO data-residency region. */
export type Smtp2goRegion = keyof typeof SMTP2GO_REGION_BASE_URLS;

export type Smtp2goOptions = {
  /**
   * SMTP2GO API key. Falls back to the `SMTP2GO_API_KEY` environment variable
   * when omitted.
   */
  apiKey?: string;
  /** Data-residency region. Ignored when an explicit `baseUrl` is provided. */
  region?: Smtp2goRegion;
  /** Override the API base URL (e.g. a proxy or a non-standard region). */
  baseUrl?: string;
  /** Custom fetch implementation (defaults to the global `fetch`). */
  fetch?: typeof fetch;
};

/** Shape exposed on the provider's `raw` field. */
export type Smtp2goRaw = {
  baseUrl: string;
  region?: Smtp2goRegion;
};

function readEnv(name: string): string | undefined {
  const env = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  return env?.[name];
}

function resolveApiKey(options: Smtp2goOptions): string {
  const apiKey = options.apiKey ?? readEnv("SMTP2GO_API_KEY");
  if (!apiKey) {
    throw new Error(
      "smtp2go: missing API key. Pass `apiKey` or set the SMTP2GO_API_KEY environment variable.",
    );
  }
  return apiKey;
}

function resolveBaseUrl(options: Smtp2goOptions): string {
  if (options.baseUrl) {
    return options.baseUrl.replace(/\/+$/, "");
  }
  if (options.region) {
    return SMTP2GO_REGION_BASE_URLS[options.region];
  }
  return SMTP2GO_DEFAULT_BASE_URL;
}

/**
 * Create the SMTP2GO adapter — an {@link EmailProvider} named `smtp2go`.
 *
 * The factory validates the API key and resolves the base URL up front so that
 * misconfiguration fails fast. Translating an {@link EmailMessage} into the
 * SMTP2GO `/email/send` payload is intentionally deferred to a follow-up task;
 * `send` throws until that mapping lands, keeping this scaffold honest while the
 * surrounding wiring (slug, options, base URL, plugin) is in place.
 */
export function smtp2go(options: Smtp2goOptions = {}): EmailProvider<Smtp2goRaw> {
  const apiKey = resolveApiKey(options);
  const baseUrl = resolveBaseUrl(options);
  const fetcher = options.fetch ?? fetch;

  return {
    name: SMTP2GO_ADAPTER_SLUG,
    raw: { baseUrl, region: options.region },
    async send(
      _message: EmailMessage,
      _context: EmailProviderContext,
    ): Promise<EmailProviderResponse> {
      // Reserved for the follow-up implementation: authenticate with the
      // resolved API key and POST the mapped payload via the resolved fetcher.
      void apiKey;
      void fetcher;
      throw new Error(
        `smtp2go: message mapping is not implemented yet (scaffold). ` +
          `Implement the payload mapping against POST ${baseUrl}${SMTP2GO_SEND_ENDPOINT}.`,
      );
    },
  };
}
