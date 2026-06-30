# Security Policy

## Supported Versions

Security fixes target the current `main` branch and the latest published npm package.

## Reporting A Vulnerability

Report security issues privately by opening a GitHub security advisory when available, or by contacting the maintainer through the repository owner profile.

Please include:

- Affected version or commit.
- Reproduction steps.
- Impact and affected files.
- Whether secrets, credentials, or private data are involved.

Do not include live secrets, tokens, private customer data, or exploit details in public issues.

## Handling Secrets

This package should not require service credentials to install. Skill workflows may inspect local repositories, so agents using these skills should avoid printing or committing `.env` files, tokens, private logs, or generated caches.
