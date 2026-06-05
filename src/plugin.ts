import type { EmailPlugin } from "@opencoredev/email-sdk";

import { SMTP2GO_ADAPTER_SLUG, smtp2go, type Smtp2goOptions } from "./smtp2go.js";

/**
 * Create the SMTP2GO plugin for `@opencoredev/email-sdk`.
 *
 * Registering this plugin adds the `smtp2go` adapter to the client, so that
 * `email.adapters.has("smtp2go")` resolves and `email.send(..., { adapter:
 * "smtp2go" })` routes through SMTP2GO. This is the recommended setup for most
 * apps; advanced users can pass {@link smtp2go} directly via `adapters`.
 */
export function smtp2goPlugin(options: Smtp2goOptions = {}): EmailPlugin {
  return {
    id: SMTP2GO_ADAPTER_SLUG,
    adapters: [smtp2go(options)],
  };
}
