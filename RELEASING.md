# Releasing

Publishing to npm is automated via [`.github/workflows/publish.yml`](./.github/workflows/publish.yml),
which runs when a GitHub Release is published.

Auth uses npm Trusted Publishing (OIDC) — there is **no `NPM_TOKEN` secret**.
The workflow runs `npm ci`, `npm run typecheck`, `npm test`, `npm run build`,
and `npm pack --dry-run`, then publishes with `--provenance`.

## npm configuration (already done)

Trusted Publishing is configured for `email-sdk-smtp2go` at
<https://www.npmjs.com/package/email-sdk-smtp2go/access>:

- Provider: **GitHub Actions**
- Repository: `stefandevo/email-sdk-smtp2go`
- Workflow filename: `publish.yml`
- Environment: blank (releases are not gated by a GitHub environment)
- Allowed action: `npm publish`

**Publishing access** is set to "Require 2FA and disallow tokens", so a release
can only come from this trusted publisher (CI) or an interactive 2FA login
(manual). There is no long-lived token to leak or rotate.

> First-publish note: a brand-new package must be published once manually
> (`npm publish --access public`, with the registry owner logged in) before a
> Trusted Publisher can be attached — npm only exposes the setting on an
> existing package. This bootstrap was done for `0.1.0`; you should never need
> to publish manually again. If the workflow file is renamed or the repo moves,
> update the Trusted Publisher config on npm.

## Cut a release

1. Bump the version on a branch and open a PR against `develop`:

   ```bash
   git checkout -b release-X.Y.Z
   npm version patch --no-git-tag-version   # or: minor / major / X.Y.Z
   git commit -am "Release X.Y.Z"
   git push -u origin release-X.Y.Z
   ```

2. Merge the PR into `develop`.

3. Create the GitHub Release — this is what triggers the publish:

   ```bash
   gh release create vX.Y.Z --target develop --title "vX.Y.Z" --generate-notes
   ```

   Or in the UI: **Releases** → **Draft a new release** → tag `vX.Y.Z`,
   target `develop` → **Generate release notes** → **Publish release**.

4. Watch the **Actions** tab. When `Publish to npm` is green, verify the
   publish log shows `Signed provenance statement ... from GitHub Actions`, then:

   ```bash
   npm view email-sdk-smtp2go version    # should match the new tag
   ```

5. Smoke-test a fresh install:

   ```bash
   tmpdir=$(mktemp -d)
   cd "$tmpdir"
   npm init -y
   npm install email-sdk-smtp2go @opencoredev/email-sdk
   node -e "import('email-sdk-smtp2go').then(m => console.log(typeof m.smtp2go, typeof m.smtp2goPlugin))"
   ```

   The final command should print:

   ```text
   function function
   ```

## Notes

- npm versions are permanent once published — never republish a version, and
  don't publish `0.0.0`.
- The `package.json` version and the release tag must agree. The tag drives the
  GitHub Release; `package.json` is what actually gets published.
- `--provenance` requires a public repo or a paid npm org.
