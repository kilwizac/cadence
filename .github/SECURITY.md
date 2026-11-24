# Security Policy

## Supported versions

Only the latest release of Cadence receives security fixes.

## Reporting a vulnerability

Please **do not** report security issues in public issues, discussions or pull requests.

Instead, use GitHub's private reporting:
[Report a vulnerability](https://github.com/kilwizac/cadence/security/advisories/new)

Please include:

- a description of the issue and its impact
- steps to reproduce, or a proof of concept
- the Cadence version and operating system you tested on

You can expect an initial response within a week. Once a fix is ready, a new release will be published and the advisory disclosed, with credit to you if you'd like.

## Scope

Cadence is a local-first desktop app. Issues of particular interest include anything that lets a crafted `.cadence` backup, workspace file or attachment execute code, read files outside Cadence's data folder, or escape the renderer sandbox.
