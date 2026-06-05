import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmailClient, EmailProviderError } from "@opencoredev/email-sdk";
import type { EmailMessage } from "@opencoredev/email-sdk";

import {
  smtp2go,
  smtp2goPlugin,
  SMTP2GO_DEFAULT_BASE_URL,
  SMTP2GO_REGION_BASE_URLS,
} from "./index.js";

const ORIGINAL_ENV = process.env.SMTP2GO_API_KEY;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.SMTP2GO_API_KEY;
  } else {
    process.env.SMTP2GO_API_KEY = ORIGINAL_ENV;
  }
});

describe("smtp2go adapter", () => {
  it("creates a provider registered under the `smtp2go` slug", () => {
    const provider = smtp2go({ apiKey: "test-key" });
    expect(provider.name).toBe("smtp2go");
  });

  it("defaults to the global base URL", () => {
    const provider = smtp2go({ apiKey: "test-key" });
    expect(provider.raw?.baseUrl).toBe(SMTP2GO_DEFAULT_BASE_URL);
  });

  it("resolves regional base URLs", () => {
    expect(smtp2go({ apiKey: "k", region: "eu" }).raw?.baseUrl).toBe(
      SMTP2GO_REGION_BASE_URLS.eu,
    );
    expect(smtp2go({ apiKey: "k", region: "us" }).raw?.baseUrl).toBe(
      SMTP2GO_REGION_BASE_URLS.us,
    );
  });

  it("lets an explicit baseUrl override the region and trims trailing slashes", () => {
    const provider = smtp2go({
      apiKey: "k",
      region: "eu",
      baseUrl: "https://proxy.example.com/v3/",
    });
    expect(provider.raw?.baseUrl).toBe("https://proxy.example.com/v3");
  });

  it("reads the API key from SMTP2GO_API_KEY when not passed", () => {
    process.env.SMTP2GO_API_KEY = "env-key";
    expect(() => smtp2go()).not.toThrow();
  });

  it("throws when no API key is available", () => {
    delete process.env.SMTP2GO_API_KEY;
    expect(() => smtp2go()).toThrow(/missing API key/i);
  });

  it("maps the EmailMessage to SMTP2GO's send payload", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async () =>
      jsonResponse({
        data: {
          email_id: "smtp2go-email-123",
          succeeded: 1,
          failed: 0,
          failures: [],
        },
      }),
    ) as unknown as typeof fetch;
    const provider = smtp2go({
      apiKey: "test-key",
      baseUrl: "https://proxy.example.com/v3/",
      fetch: fetcher,
    });

    const response = await provider.send(
      {
        from: { name: "Ada Lovelace", email: "ada@example.com" },
        to: [{ name: "Grace Hopper", email: "grace@example.com" }],
        cc: "cc@example.com",
        bcc: { name: "Hidden", email: "hidden@example.com" },
        replyTo: [
          { name: "Replies", email: "reply@example.com" },
          "reply-two@example.com",
        ],
        subject: "Hello from SMTP2GO",
        html: "<p>Hello</p>",
        text: "Hello",
        headers: {
          "X-Trace": "trace-1",
        },
      },
      { attempt: 1, signal: controller.signal },
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetcher).mock.calls[0]!;
    expect(url).toBe("https://proxy.example.com/v3/email/send");
    expect(init).toMatchObject({
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Smtp2go-Api-Key": "test-key",
      },
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      sender: "Ada Lovelace <ada@example.com>",
      to: ["Grace Hopper <grace@example.com>"],
      cc: ["cc@example.com"],
      bcc: ["Hidden <hidden@example.com>"],
      subject: "Hello from SMTP2GO",
      html_body: "<p>Hello</p>",
      text_body: "Hello",
      custom_headers: [
        { header: "X-Trace", value: "trace-1" },
        {
          header: "Reply-To",
          value: "Replies <reply@example.com>, reply-two@example.com",
        },
      ],
    });
    expect(response).toEqual({
      provider: "smtp2go",
      id: "smtp2go-email-123",
      messageId: "smtp2go-email-123",
      raw: {
        data: {
          email_id: "smtp2go-email-123",
          succeeded: 1,
          failed: 0,
          failures: [],
        },
      },
    });
  });

  it("quotes display names that need escaping", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        data: {
          email_id: "smtp2go-email-escaped",
          succeeded: 1,
          failed: 0,
          failures: [],
        },
      }),
    ) as unknown as typeof fetch;
    const provider = smtp2go({ apiKey: "test-key", fetch: fetcher });

    await provider.send(
      {
        from: { name: 'Doe, "Jane"', email: "jane@example.com" },
        to: { name: "Smith, John", email: "john@example.com" },
        replyTo: { name: 'Support "Team"', email: "support@example.com" },
        subject: "Escaped names",
        text: "Hello",
      },
      { attempt: 1 },
    );

    const [, init] = vi.mocked(fetcher).mock.calls[0]!;
    expect(JSON.parse(init?.body as string)).toMatchObject({
      sender: '"Doe, \\"Jane\\"" <jane@example.com>',
      to: ['"Smith, John" <john@example.com>'],
      custom_headers: [
        {
          header: "Reply-To",
          value: '"Support \\"Team\\"" <support@example.com>',
        },
      ],
    });
  });

  it("maps regular attachments to SMTP2GO attachments", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        data: {
          email_id: "smtp2go-email-attachments",
          succeeded: 1,
          failed: 0,
          failures: [],
        },
      }),
    ) as unknown as typeof fetch;
    const provider = smtp2go({ apiKey: "test-key", fetch: fetcher });

    await provider.send(
      {
        ...baseMessage(),
        attachments: [
          {
            filename: "receipt.txt",
            content: "Order #123",
            contentType: "text/plain",
          },
          {
            filename: "encoded.pdf",
            content: "cGRmLWRhdGE=",
            contentEncoding: "base64",
            contentType: "application/pdf",
          },
          {
            filename: "bytes.bin",
            content: new Uint8Array([0, 1, 2, 255]),
          },
        ],
      },
      { attempt: 1 },
    );

    const [, init] = vi.mocked(fetcher).mock.calls[0]!;
    expect(JSON.parse(init?.body as string)).toMatchObject({
      attachments: [
        {
          filename: "receipt.txt",
          mimetype: "text/plain",
          fileblob: "T3JkZXIgIzEyMw==",
        },
        {
          filename: "encoded.pdf",
          mimetype: "application/pdf",
          fileblob: "cGRmLWRhdGE=",
        },
        {
          filename: "bytes.bin",
          fileblob: "AAEC/w==",
        },
      ],
    });
  });

  it("passes URL attachments through to SMTP2GO attachments", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        data: {
          email_id: "smtp2go-email-url-attachment",
          succeeded: 1,
          failed: 0,
          failures: [],
        },
      }),
    ) as unknown as typeof fetch;
    const provider = smtp2go({ apiKey: "test-key", fetch: fetcher });

    await provider.send(
      {
        ...baseMessage(),
        attachments: [
          {
            filename: "terms.pdf",
            contentType: "application/pdf",
            url: "https://cdn.example.com/terms.pdf",
          },
        ],
      } as EmailMessage,
      { attempt: 1 },
    );

    const [, init] = vi.mocked(fetcher).mock.calls[0]!;
    expect(JSON.parse(init?.body as string)).toMatchObject({
      attachments: [
        {
          filename: "terms.pdf",
          mimetype: "application/pdf",
          url: "https://cdn.example.com/terms.pdf",
        },
      ],
    });
  });

  it("maps inline attachments to SMTP2GO inlines with cids", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        data: {
          email_id: "smtp2go-email-inline",
          succeeded: 1,
          failed: 0,
          failures: [],
        },
      }),
    ) as unknown as typeof fetch;
    const provider = smtp2go({ apiKey: "test-key", fetch: fetcher });

    await provider.send(
      {
        ...baseMessage(),
        html: '<p><img src="cid:logo-cid"></p><p><img src="cid:hero.png"></p>',
        attachments: [
          {
            filename: "logo.png",
            content: new Uint8Array([137, 80, 78, 71]),
            contentType: "image/png",
            contentId: "logo-cid",
            disposition: "inline",
          },
          {
            filename: "hero.png",
            content: "hero-image",
            contentType: "image/png",
            inline: true,
          },
        ],
      } as EmailMessage,
      { attempt: 1 },
    );

    const [, init] = vi.mocked(fetcher).mock.calls[0]!;
    expect(JSON.parse(init?.body as string)).toMatchObject({
      inlines: [
        {
          filename: "logo.png",
          mimetype: "image/png",
          fileblob: "iVBORw==",
          cid: "logo-cid",
        },
        {
          filename: "hero.png",
          mimetype: "image/png",
          fileblob: "aGVyby1pbWFnZQ==",
          cid: "hero.png",
        },
      ],
    });
  });

  it.each([
    ["tags", { tags: [{ name: "kind", value: "receipt" }] }, {}],
    ["metadata", { metadata: { accountId: "acct_123" } }, {}],
    ["message idempotencyKey", { idempotencyKey: "idem_123" }, {}],
    ["context idempotencyKey", {}, { idempotencyKey: "idem_123" }],
  ])("throws for unsupported non-empty %s", async (_name, messagePatch, contextPatch) => {
    const provider = smtp2go({
      apiKey: "test-key",
      fetch: vi.fn() as unknown as typeof fetch,
    });

    await expect(
      provider.send(
        {
          from: "from@example.com",
          to: "to@example.com",
          subject: "Unsupported field",
          text: "Hello",
          ...messagePatch,
        },
        { attempt: 1, ...contextPatch },
      ),
    ).rejects.toThrow(/does not support/i);
  });

  it("throws a normalized provider error for non-2xx responses", async () => {
    const provider = smtp2go({
      apiKey: "test-key",
      fetch: vi.fn(async () =>
        jsonResponse(
          {
            data: {
              error_code: "bad_request",
              error: "Sender address is invalid",
            },
          },
          400,
        ),
      ) as unknown as typeof fetch,
    });

    await expect(
      provider.send(
        {
          from: "from@example.com",
          to: "to@example.com",
          subject: "Bad sender",
          text: "Hello",
        },
        { attempt: 1 },
      ),
    ).rejects.toMatchObject({
      name: "EmailProviderError",
      code: "bad_request",
      provider: "smtp2go",
      status: 400,
      retryable: false,
      message: expect.stringContaining("Sender address is invalid"),
    } satisfies Partial<EmailProviderError>);
  });

  it("throws a normalized provider error for SMTP2GO data errors", async () => {
    const provider = smtp2go({
      apiKey: "test-key",
      fetch: vi.fn(async () =>
        jsonResponse({
          data: {
            error_code: "recipient_failed",
            error: "Recipient rejected",
          },
        }),
      ) as unknown as typeof fetch,
    });

    await expect(
      provider.send(
        {
          from: "from@example.com",
          to: "to@example.com",
          subject: "Rejected",
          text: "Hello",
        },
        { attempt: 1 },
      ),
    ).rejects.toMatchObject({
      name: "EmailProviderError",
      code: "recipient_failed",
      provider: "smtp2go",
      retryable: false,
      message: expect.stringContaining("Recipient rejected"),
    } satisfies Partial<EmailProviderError>);
  });

  it("throws when SMTP2GO reports recipient failures", async () => {
    const provider = smtp2go({
      apiKey: "test-key",
      fetch: vi.fn(async () =>
        jsonResponse({
          data: {
            email_id: "smtp2go-email-123",
            succeeded: 0,
            failed: 1,
            failures: [{ email: "to@example.com", reason: "Suppressed" }],
          },
        }),
      ) as unknown as typeof fetch,
    });

    await expect(
      provider.send(
        {
          from: "from@example.com",
          to: "to@example.com",
          subject: "Recipient failure",
          text: "Hello",
        },
        { attempt: 1 },
      ),
    ).rejects.toMatchObject({
      name: "EmailProviderError",
      provider: "smtp2go",
      retryable: false,
      message: expect.stringContaining("Suppressed"),
    } satisfies Partial<EmailProviderError>);
  });
});

describe("smtp2goPlugin", () => {
  it("registers the smtp2go adapter on the client", () => {
    const email = createEmailClient({
      plugins: [smtp2goPlugin({ apiKey: "test-key" })],
    });
    expect(email.adapters.has("smtp2go")).toBe(true);
  });

  it("uses `smtp2go` as the plugin id", () => {
    expect(smtp2goPlugin({ apiKey: "test-key" }).id).toBe("smtp2go");
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function baseMessage(): EmailMessage {
  return {
    from: "from@example.com",
    to: "to@example.com",
    subject: "Attachments",
    text: "Hello",
  };
}
