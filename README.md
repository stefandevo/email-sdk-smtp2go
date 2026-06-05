# email-sdk-smtp2go

[SMTP2GO](https://www.smtp2go.com/) adapter and plugin for
[email-sdk.dev](https://email-sdk.dev) (`@opencoredev/email-sdk`).

> **Status:** core send mapping is implemented. The adapter posts normalized
> messages to SMTP2GO's `/email/send` endpoint; attachments and inline content
> are planned for a follow-up task.

## Install

```sh
npm install email-sdk-smtp2go @opencoredev/email-sdk
```

`@opencoredev/email-sdk` is a peer dependency (`^0.4.0`), so your app and this
adapter share a single copy of the core types.

## Usage

### Plugin (recommended)

```ts
import { createEmailClient } from "@opencoredev/email-sdk";
import { smtp2goPlugin } from "email-sdk-smtp2go";

const email = createEmailClient({
  plugins: [smtp2goPlugin({ apiKey: process.env.SMTP2GO_API_KEY })],
});

// The `smtp2go` adapter is now registered:
email.adapters.has("smtp2go"); // true
```

### Adapter (advanced)

```ts
import { createEmailClient } from "@opencoredev/email-sdk";
import { smtp2go } from "email-sdk-smtp2go";

const email = createEmailClient({
  adapters: [smtp2go({ apiKey: process.env.SMTP2GO_API_KEY })],
  defaultAdapter: "smtp2go",
});
```

## Options

`Smtp2goOptions`:

| Option    | Type             | Default                      | Description                                            |
| --------- | ---------------- | ---------------------------- | ------------------------------------------------------ |
| `apiKey`  | `string`         | `SMTP2GO_API_KEY` env var    | SMTP2GO API key. Required (via option or env).         |
| `region`  | `"us"` \| `"eu"` | global API                   | Data-residency region. Ignored when `baseUrl` is set.  |
| `baseUrl` | `string`         | `https://api.smtp2go.com/v3` | Override the API base URL (proxy or region).           |
| `fetch`   | `typeof fetch`   | global `fetch`               | Custom fetch implementation.                           |

The API key is read from `SMTP2GO_API_KEY` when `apiKey` is omitted.

## Development

```sh
npm install
npm run build   # tsc → dist/ (JS + type declarations)
npm test        # vitest
```

## License

[MIT](./LICENSE)
