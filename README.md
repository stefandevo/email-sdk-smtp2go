# email-sdk-smtp2go

[SMTP2GO](https://www.smtp2go.com/) adapter and plugin for
[email-sdk.dev](https://email-sdk.dev) (`@opencoredev/email-sdk`).

> **Status:** core send mapping, attachments, and inline images are implemented.
> The adapter posts normalized messages to SMTP2GO's `/email/send` endpoint.

## Install

```sh
npm install email-sdk-smtp2go @opencoredev/email-sdk
```

`@opencoredev/email-sdk` is a peer dependency (`^0.6.1`), so your app and this
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

## Attachments And Inline Images

Attachments are mapped to SMTP2GO `attachments[]` entries. Raw string, binary,
`ArrayBuffer`, `Blob`, and Base64-encoded content are sent as Base64 `fileblob`
values. URL-backed attachments can be supplied with a `url` field or an
`http(s)` `path`, and are passed through as SMTP2GO `url` values.

```ts
await email.send({
  from: "from@example.com",
  to: "to@example.com",
  subject: "Receipt",
  text: "Thanks",
  html: '<p><img src="cid:logo"></p>',
  attachments: [
    {
      filename: "receipt.pdf",
      content: pdfBytes,
      contentType: "application/pdf",
    },
    {
      filename: "logo.png",
      content: logoBytes,
      contentType: "image/png",
      contentId: "logo",
      disposition: "inline",
    },
  ],
});
```

Inline images are mapped to SMTP2GO `inlines[]`. The CID is chosen from
`contentId`, then `cid`, then the filename when an attachment is marked inline
without an explicit CID.

## Development

```sh
npm install
npm run build   # tsc → dist/ (JS + type declarations)
npm test        # vitest
```

## License

[MIT](./LICENSE)
