# Releasing

Publishing to npm is automated via [`.github/workflows/publish.yml`](./.github/workflows/publish.yml),
which runs when a GitHub Release is published.

The preferred auth path is npm Trusted Publishing (OIDC), so no long-lived
`NPM_TOKEN` secret is required when the package is configured correctly on npm.
The workflow also supports `NPM_TOKEN` as a fallback.

## One-time npm setup

Before the first release, configure Trusted Publishing for
`email-sdk-smtp2go` on npm:

1. Go to `https://www.npmjs.com/package/email-sdk-smtp2go/access`.
2. Add a Trusted Publisher.
3. Choose **GitHub Actions**.
4. Set the repository to `stefandevo/email-sdk-smtp2go`.
5. Set the workflow filename to `publish.yml`.
6. Leave the environment blank unless you protect releases with a GitHub
   environment.

If Trusted Publishing is not available, add an npm automation token as the
GitHub Actions secret `NPM_TOKEN`.

## Cut a release

This package is currently prepared for its first release as `0.1.0`.

After the release PR is merged:

```bash
git checkout develop
git pull
git tag v0.1.0
git push origin v0.1.0
```

Then on GitHub:

1. Go to **Releases** -> **Draft a new release**.
2. Pick the tag you just pushed, for example `v0.1.0`.
3. Click **Generate release notes**.
4. Click **Publish release**.

Watch the **Actions** tab. When `Publish to npm` is green, verify npm:

```bash
npm view email-sdk-smtp2go version
npm view email-sdk-smtp2go repository.url peerDependencies --json
```

Then smoke-test a fresh install:

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

## Future releases

For later releases, use `npm version` so `package.json`,
`package-lock.json`, and the git tag stay aligned:

```bash
npm version patch -m "chore(release): %s"   # or: minor / major / X.Y.Z
git push --follow-tags
```

Then publish a GitHub Release for the new tag.

## Notes

- Do not publish `0.0.0`; npm versions are permanent once published.
- `package.json` version and the git tag must agree.
- The workflow runs `npm ci`, `npm run typecheck`, `npm test`,
  `npm run build`, and `npm pack --dry-run` before publishing.
- `npm publish --provenance --access public` expects a public GitHub-hosted
  workflow and either Trusted Publishing or `NPM_TOKEN`.
- If the workflow file is renamed or the repository moves, update the Trusted
  Publisher configuration on npm.
