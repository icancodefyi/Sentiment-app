# Contributing

## Branch model

- **`main` is the only long-lived branch.** It is the default branch on GitHub and the integration line for all work.
- **Open every pull request against `main`.** Do not maintain parallel long-lived branches (for example a separate `develop` or `master`).
- Use **short-lived topic branches** for changes (`feature/…`, `fix/…`, `chore/…`), open a PR into `main`, merge, then delete the topic branch on GitHub (use the “Delete branch” button after merge).

This keeps history, reviews, and releases aligned on a single trunk.

## Local setup

From the repository root:

```bash
pnpm install
pnpm dev
```

See the root `package.json` scripts for build and lint commands.
