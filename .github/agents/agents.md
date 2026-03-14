# Agent Guidelines

## Commit Messages

Always use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) when creating commits.

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Changes that do not affect the meaning of the code (formatting, missing semi-colons, etc.) |
| `refactor` | A code change that neither fixes a bug nor adds a feature |
| `perf` | A code change that improves performance |
| `test` | Adding missing tests or correcting existing tests |
| `build` | Changes that affect the build system or external dependencies |
| `ci` | Changes to CI configuration files and scripts |
| `chore` | Other changes that don't modify source or test files |
| `revert` | Reverts a previous commit |

### Examples

```
feat: add quiz timer functionality
fix(auth): resolve login redirect issue
docs: update README with setup instructions
chore: bump dependencies
```

### Breaking Changes

Append `!` after the type/scope for breaking changes, and include a `BREAKING CHANGE:` footer:

```
feat!: redesign quiz API

BREAKING CHANGE: quiz endpoint now requires authentication
```

## Pull Request Titles

Always use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format for PR titles, following the same rules as commit messages above.

### Examples

```
feat: add multiplayer support
fix(ui): correct button alignment on mobile
chore: update Docker base image
```

## Upload Progress

Always use the reusable `UploadProgressModal` component (located at `src/components/UploadProgressModal.tsx`) to show upload progress whenever files are uploaded by the user. This includes, but is not limited to:

- Importing questions (ZIP with media)
- Importing games (ZIP with media)
- Uploading media files (audio, images, etc.)

Use the `uploadWithProgress` utility (`src/utils/uploadWithProgress.ts`) to perform uploads via `XMLHttpRequest` so that real-time progress events are available. Pass the progress percentage to the `UploadProgressModal` to keep the user informed.
