import { EmailProviderError, EmailValidationError } from "@opencoredev/email-sdk";
import type {
  EmailAddress,
  EmailAttachment,
  EmailHeader,
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

type Smtp2goCustomHeader = {
  header: string;
  value: string;
};

type Smtp2goAttachment = {
  filename: string;
  mimetype?: string;
  fileblob?: string;
  url?: string;
};

type Smtp2goInline = Smtp2goAttachment & {
  cid: string;
};

type Smtp2goSendPayload = {
  sender: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html_body?: string;
  text_body?: string;
  custom_headers?: Smtp2goCustomHeader[];
  attachments?: Smtp2goAttachment[];
  inlines?: Smtp2goInline[];
};

type Smtp2goAttachmentInput = EmailAttachment & {
  cid?: string;
  inline?: boolean;
  url?: string;
};

type Smtp2goSendData = {
  email_id?: unknown;
  succeeded?: unknown;
  failed?: unknown;
  failures?: unknown;
  error_code?: unknown;
  error?: unknown;
};

type Smtp2goSendResponseBody = {
  data?: Smtp2goSendData;
  error_code?: unknown;
  error?: unknown;
  [key: string]: unknown;
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

function arrayify<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function formatAddress(address: EmailAddress): string {
  if (typeof address === "string") {
    return address;
  }
  if (!address.name) {
    return address.email;
  }
  return `${formatDisplayName(address.name)} <${address.email}>`;
}

function formatAddresses(addresses: EmailAddress | EmailAddress[] | undefined): string[] {
  return arrayify(addresses).map(formatAddress);
}

function formatDisplayName(name: string): string {
  if (!/[",\\]/.test(name)) {
    return name;
  }
  return `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function headersToCustomHeaders(
  headers: EmailMessage["headers"],
): Smtp2goCustomHeader[] {
  if (!headers) {
    return [];
  }
  const headerEntries: EmailHeader[] = Array.isArray(headers)
    ? headers
    : Object.entries(headers).map(([name, value]) => ({ name, value }));

  return headerEntries.map((header) => ({
    header: header.name,
    value: header.value,
  }));
}

function hasValues(value: unknown): boolean {
  if (!value) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true;
}

function assertMaxItems(field: string, values: unknown[], max: number): void {
  if (values.length <= max) {
    return;
  }
  throw new EmailValidationError(
    `smtp2go only supports ${max} ${field}${max === 1 ? "" : "s"} per message.`,
    { adapter: SMTP2GO_ADAPTER_SLUG, field, max, count: values.length },
  );
}

function assertSupportedMessage(
  message: EmailMessage,
  context: EmailProviderContext,
): void {
  const unsupported = new Set<string>();
  if (message.tags?.length) {
    unsupported.add("tags");
  }
  if (hasValues(message.metadata)) {
    unsupported.add("metadata");
  }
  if (message.idempotencyKey || context.idempotencyKey) {
    unsupported.add("idempotencyKey");
  }
  if (unsupported.size > 0) {
    throw new EmailValidationError(
      `smtp2go does not support these EmailMessage fields: ${[...unsupported].join(", ")}.`,
      { adapter: SMTP2GO_ADAPTER_SLUG, unsupported: [...unsupported] },
    );
  }

  assertMaxItems("to recipient", formatAddresses(message.to), 100);
  assertMaxItems("cc recipient", formatAddresses(message.cc), 100);
  assertMaxItems("bcc recipient", formatAddresses(message.bcc), 100);
}

async function toSmtp2goPayload(message: EmailMessage): Promise<Smtp2goSendPayload> {
  const customHeaders = headersToCustomHeaders(message.headers);
  const replyTo = formatAddresses(message.replyTo);
  if (replyTo.length > 0) {
    customHeaders.push({
      header: "Reply-To",
      value: replyTo.join(", "),
    });
  }
  const { attachments, inlines } = await toSmtp2goAttachments(message.attachments);

  return {
    sender: formatAddress(message.from),
    to: formatAddresses(message.to),
    cc: optionalAddresses(message.cc),
    bcc: optionalAddresses(message.bcc),
    subject: message.subject,
    html_body: message.html,
    text_body: message.text,
    custom_headers: customHeaders.length > 0 ? customHeaders : undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
    inlines: inlines.length > 0 ? inlines : undefined,
  };
}

async function toSmtp2goAttachments(
  attachments: EmailAttachment[] | undefined,
): Promise<{ attachments: Smtp2goAttachment[]; inlines: Smtp2goInline[] }> {
  const smtp2goAttachments: Smtp2goAttachment[] = [];
  const inlines: Smtp2goInline[] = [];

  for (const attachment of attachments ?? []) {
    const mapped = await toSmtp2goAttachment(attachment);
    if (isInlineAttachment(attachment)) {
      inlines.push({
        ...mapped,
        cid: inlineAttachmentCid(attachment),
      });
    } else {
      smtp2goAttachments.push(mapped);
    }
  }

  return { attachments: smtp2goAttachments, inlines };
}

async function toSmtp2goAttachment(
  attachment: EmailAttachment,
): Promise<Smtp2goAttachment> {
  const extended = attachment as Smtp2goAttachmentInput;
  const url = attachmentUrl(extended);
  const base = {
    filename: attachment.filename,
    mimetype: attachment.contentType,
  };

  if (url && attachment.content === undefined) {
    return {
      ...base,
      url,
    };
  }

  return {
    ...base,
    fileblob: await attachmentContentToBase64(attachment),
  };
}

async function attachmentContentToBase64(
  attachment: EmailAttachment,
): Promise<string> {
  if (attachment.path) {
    throw new EmailValidationError(
      `Attachment "${attachment.filename}" path must be an http(s) URL or include content.`,
      { adapter: SMTP2GO_ADAPTER_SLUG, field: "attachments" },
    );
  }
  if (attachment.content === undefined) {
    throw new EmailValidationError(
      `Attachment "${attachment.filename}" requires content, path, or url.`,
      { adapter: SMTP2GO_ADAPTER_SLUG, field: "attachments" },
    );
  }
  if (typeof attachment.content === "string") {
    return attachment.contentEncoding === "base64"
      ? attachment.content
      : bytesToBase64(new TextEncoder().encode(attachment.content));
  }
  if (typeof Blob !== "undefined" && attachment.content instanceof Blob) {
    return bytesToBase64(new Uint8Array(await attachment.content.arrayBuffer()));
  }
  if (attachment.content instanceof ArrayBuffer) {
    return bytesToBase64(new Uint8Array(attachment.content));
  }
  return bytesToBase64(attachment.content as Uint8Array);
}

function isInlineAttachment(attachment: EmailAttachment): boolean {
  const extended = attachment as Smtp2goAttachmentInput;
  return Boolean(
    attachment.disposition === "inline" ||
      attachment.contentId ||
      extended.cid ||
      extended.inline,
  );
}

function inlineAttachmentCid(attachment: EmailAttachment): string {
  const extended = attachment as Smtp2goAttachmentInput;
  return attachment.contentId ?? extended.cid ?? attachment.filename;
}

function attachmentUrl(attachment: Smtp2goAttachmentInput): string | undefined {
  if (attachment.url) {
    return attachment.url;
  }
  return isHttpUrl(attachment.path) ? attachment.path : undefined;
}

function isHttpUrl(value: string | undefined): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function optionalAddresses(
  addresses: EmailAddress | EmailAddress[] | undefined,
): string[] | undefined {
  const formatted = formatAddresses(addresses);
  return formatted.length > 0 ? formatted : undefined;
}

async function readResponseBody(response: Response): Promise<Smtp2goSendResponseBody> {
  const text = await response.text().catch(() => undefined);
  if (!text) {
    return {};
  }
  const json = parseJson(text);
  return isRecord(json) ? json : { error: text };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function extractError(body: Smtp2goSendResponseBody): {
  code?: string;
  message?: string;
} {
  const data = isRecord(body.data) ? body.data : undefined;
  const code = firstString(data?.error_code, body.error_code);
  const message = firstString(data?.error, body.error);
  return { code, message };
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string");
}

function throwSmtp2goError(
  body: Smtp2goSendResponseBody,
  status?: number,
): never {
  const { code, message } = extractError(body);
  const statusText = status === undefined ? "" : ` with ${status}`;
  throw new EmailProviderError(
    `smtp2go failed${statusText}: ${message ?? "SMTP2GO returned an error."}`,
    {
      provider: SMTP2GO_ADAPTER_SLUG,
      status,
      retryable: status === undefined ? false : isRetryableStatus(status),
      details: body,
      ...(code ? { code } : {}),
    },
  );
}

function assertSmtp2goSuccess(body: Smtp2goSendResponseBody): void {
  const data = body.data;
  if (!data) {
    return;
  }

  if (typeof data.error === "string" || typeof data.error_code === "string") {
    throwSmtp2goError(body);
  }

  const failed = typeof data.failed === "number" ? data.failed : 0;
  const failures = Array.isArray(data.failures) ? data.failures : [];
  if (failed > 0 || failures.length > 0) {
    const detail = summarizeFailures(failures);
    throw new EmailProviderError(
      `smtp2go reported recipient failures${detail ? `: ${detail}` : "."}`,
      {
        provider: SMTP2GO_ADAPTER_SLUG,
        retryable: false,
        details: body,
        code: "recipient_failed",
      },
    );
  }
}

function summarizeFailures(failures: unknown[]): string | undefined {
  const summary = failures
    .map((failure) => {
      if (!isRecord(failure)) {
        return undefined;
      }
      const email = firstString(failure.email, failure.recipient);
      const reason = firstString(failure.reason, failure.error, failure.message);
      if (email && reason) {
        return `${email}: ${reason}`;
      }
      return reason ?? email;
    })
    .filter((value): value is string => Boolean(value));
  return summary.length > 0 ? summary.join("; ") : undefined;
}

/**
 * Create the SMTP2GO adapter — an {@link EmailProvider} named `smtp2go`.
 *
 * The factory validates the API key and resolves the base URL up front so that
 * misconfiguration fails fast. `send` maps the normalized {@link EmailMessage}
 * into SMTP2GO's `/email/send` JSON payload, forwards the caller's
 * {@link AbortSignal}, and normalizes SMTP2GO API failures into
 * {@link EmailProviderError}.
 */
export function smtp2go(options: Smtp2goOptions = {}): EmailProvider<Smtp2goRaw> {
  const apiKey = resolveApiKey(options);
  const baseUrl = resolveBaseUrl(options);
  const fetcher = options.fetch ?? fetch;

  return {
    name: SMTP2GO_ADAPTER_SLUG,
    raw: { baseUrl, region: options.region },
    async send(
      message: EmailMessage,
      context: EmailProviderContext,
    ): Promise<EmailProviderResponse> {
      assertSupportedMessage(message, context);
      const response = await fetcher(`${baseUrl}${SMTP2GO_SEND_ENDPOINT}`, {
        method: "POST",
        signal: context.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Smtp2go-Api-Key": apiKey,
        },
        body: JSON.stringify(await toSmtp2goPayload(message)),
      });
      const body = await readResponseBody(response);

      if (!response.ok) {
        throwSmtp2goError(body, response.status);
      }
      assertSmtp2goSuccess(body);

      const messageId =
        typeof body.data?.email_id === "string" ? body.data.email_id : undefined;
      return {
        provider: SMTP2GO_ADAPTER_SLUG,
        id: messageId,
        messageId,
        raw: body,
      };
    },
  };
}
