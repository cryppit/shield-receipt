# Contributing

Issues and pull requests are welcome. The most useful report is a real withdrawal the page reads wrongly.

## Ground rules

- **Keyless and read-only.** No change may ask for a key, seed, viewing key or wallet connection, or sign or broadcast
  anything.
- **Only the transaction ID leaves the page.** The address stays in the browser. It must never reach a URL, a log or a
  third party.
- **Facts from the chain.** Every verdict comes from the transaction itself. If the page can't tell, it says so.

## Development

Node 22.15 or newer, pnpm 11.

```bash
pnpm install
pnpm test
```

Write the failing test first. Fixtures are real public transactions, trimmed to what the test needs. TypeScript is strict:
do not use `any`, and parse unknown JSON with type guards. A new dependency needs an exact version.

## Pull requests

For commits, branches and review, follow [librustzcash's contribution guidelines](https://github.com/zcash/librustzcash/blob/main/CONTRIBUTING.md),
the reference style for Zcash projects, adapted to TypeScript where they are Rust-specific.

Keep one change per pull request, and say what it changes for someone checking a withdrawal and how you tested it. By
contributing you agree that your contribution is licensed under the MIT licence of this repository.

## Security

If you find a way the page could leak an address or give a wrong "shielded" answer, do not open a public issue. Contact
the maintainers privately first.
