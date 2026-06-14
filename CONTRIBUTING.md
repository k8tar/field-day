# Contributing

Thanks for contributing to Field Day Logger.

## Release Automation

This repository uses Release Please to automate versioning and tags.

1. Push changes to `develop`.
2. Release Please opens or updates a release PR.
3. Merging that release PR creates a `v*` tag.
4. Tag workflows build artifacts and publish a GitHub Release.

## Commit Message Format

Use Conventional Commits so release versions are correct.

Format:

```
<type>(optional-scope): <short summary>
```

Examples:

- `fix(sync): avoid duplicate mesh messages`
- `feat(ui): add station reset confirmation`
- `docs(readme): add release workflow notes`
- `chore(ci): bump github action versions`

Common types:

- `fix`: bug fix (patch release)
- `feat`: new feature (minor release)
- `docs`: documentation changes
- `chore`: maintenance or tooling updates
- `refactor`: code restructuring without behavior changes
- `test`: tests only
- `ci`: workflow and pipeline changes

Breaking changes:

1. Add `!` after the type or scope, for example `feat(api)!: change station payload schema`.
2. Include a `BREAKING CHANGE:` note in the commit body.

## Pull Request Checklist

1. Run checks locally:

```bash
npm run lint:oxlint
npm run lint:eslint
npm run typecheck
npm run test:unit
```

2. Keep PRs focused and small when possible.
3. Describe user-facing impact in the PR description.
4. If behavior changes, include tests.

## Branching

1. Open PRs into `develop`.
2. Do not push directly to release tags.
3. Let Release Please create release tags.
