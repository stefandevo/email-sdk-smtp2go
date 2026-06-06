import { describe, expect, it, vi } from "vitest";

import {
  parseSmokeSendArgs,
  runSmokeSend,
} from "./smoke-send.mjs";

describe("smoke-send CLI", () => {
  it("fails fast when SMTP2GO_API_KEY is missing", () => {
    const result = parseSmokeSendArgs(
      ["--from", "from@example.com", "--to", "to@example.com"],
      {},
    );

    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining("SMTP2GO_API_KEY"),
    });
  });

  it("fails fast when required address args are missing", () => {
    const result = parseSmokeSendArgs(["--from", "from@example.com"], {
      SMTP2GO_API_KEY: "api-test",
    });

    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining("--to"),
    });
  });

  it("parses supported send options with useful defaults", () => {
    const result = parseSmokeSendArgs(
      [
        "--from",
        "Acme <hello@example.com>",
        "--to",
        "user@example.com",
        "--region",
        "eu",
        "--base-url",
        "https://proxy.example.com/v3",
      ],
      { SMTP2GO_API_KEY: "api-test" },
    );

    expect(result).toEqual({
      ok: true,
      options: {
        apiKey: "api-test",
        from: "Acme <hello@example.com>",
        to: "user@example.com",
        subject: "SMTP2GO smoke test",
        text: "SMTP2GO live smoke test from email-sdk-smtp2go.",
        region: "eu",
        baseUrl: "https://proxy.example.com/v3",
      },
    });
  });

  it("sends through the email client and prints SMTP2GO identifiers", async () => {
    const send = vi.fn(async () => ({
      provider: "smtp2go",
      id: "smtp2go-email-123",
      messageId: "smtp2go-message-123",
    }));
    const createEmailClient = vi.fn(() => ({ send }));
    const smtp2goPlugin = vi.fn((options) => ({ id: "smtp2go", options }));
    const stdout = vi.fn();
    const stderr = vi.fn();

    const exitCode = await runSmokeSend(
      [
        "--from",
        "from@example.com",
        "--to",
        "to@example.com",
        "--subject",
        "Live check",
        "--text",
        "Hello",
      ],
      { SMTP2GO_API_KEY: "api-test" },
      { stdout, stderr },
      { createEmailClient, smtp2goPlugin },
    );

    expect(exitCode).toBe(0);
    expect(smtp2goPlugin).toHaveBeenCalledWith({ apiKey: "api-test" });
    expect(createEmailClient).toHaveBeenCalledWith({
      plugins: [{ id: "smtp2go", options: { apiKey: "api-test" } }],
    });
    expect(send).toHaveBeenCalledWith({
      from: "from@example.com",
      to: "to@example.com",
      subject: "Live check",
      text: "Hello",
    });
    expect(stdout).toHaveBeenCalledWith("provider: smtp2go");
    expect(stdout).toHaveBeenCalledWith("id: smtp2go-email-123");
    expect(stdout).toHaveBeenCalledWith("messageId: smtp2go-message-123");
    expect(stderr).not.toHaveBeenCalled();
  });
});
