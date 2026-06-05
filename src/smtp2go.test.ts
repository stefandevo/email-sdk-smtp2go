import { afterEach, describe, expect, it } from "vitest";
import { createEmailClient } from "@opencoredev/email-sdk";

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

  it("throws from send until message mapping is implemented", async () => {
    const provider = smtp2go({ apiKey: "test-key" });
    await expect(
      provider.send(
        { from: "a@example.com", to: "b@example.com", subject: "hi" },
        { attempt: 1 },
      ),
    ).rejects.toThrow(/not implemented yet/i);
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
