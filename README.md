# email-sdk-smtp2go

[SMTP2GO](https://www.smtp2go.com/) adapter and plugin for
[email-sdk.dev](https://email-sdk.dev) (`@opencoredev/email-sdk`).

> **Status:** core send mapping, attachments, and inline images are implemented.
> The adapter posts normalized messages to SMTP2GO's `/email/send` endpoint.

## Reference Docs

- [Email SDK adapter-authoring guide](https://email-sdk.dev/docs/guides/authoring/create-adapter)
- [Email SDK adapter contract](https://email-sdk.dev/docs/reference/adapter-contract)
- [Email SDK community adapter guide](https://email-sdk.dev/docs/guides/authoring/publish-community-adapter)
- [SMTP2GO `/email/send` guide](https://developers.smtp2go.com/docs/send-an-email)
- [SMTP2GO `/email/send` API reference](https://developers.smtp2go.com/reference/send-standard-email)
- [SMTP2GO attachment guide](https://developers.smtp2go.com/docs/adding-attachments)

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
email.defaultAdapter; // "smtp2go"
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

## Field Support

Unsupported non-empty Email SDK fields throw before sending. This keeps fallback
routes from silently losing message data that SMTP2GO cannot represent.

| Field | Support | Notes |
| --- | --- | --- |
| `html`, `text` | Yes | Mapped to SMTP2GO `html_body` and `text_body`. |
| `cc`, `bcc` | Yes | Mapped to SMTP2GO recipient arrays. |
| `replyTo` | Yes | Appended as a `Reply-To` custom header. |
| `headers` | Yes | Mapped to SMTP2GO `custom_headers`. |
| `attachments` | Yes | Base64 `fileblob` entries or provider URL attachment entries. |
| `inline` attachments | Yes | Mapped to SMTP2GO `inlines[]` with CID. |
| `tags` | No | Throws when non-empty. |
| `metadata` | No | Throws when non-empty. Use send-option metadata only for Email SDK hooks and observability. |
| `idempotencyKey` | No | Throws because SMTP2GO does not expose compatible idempotency support. |

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
