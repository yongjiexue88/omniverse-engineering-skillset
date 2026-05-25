# API Documentation Review Checklist

Use this checklist for REST, GraphQL, RPC, webhook, SDK, CLI, and integration documentation.

## Audience and Scope

- Is the target reader clear: internal developer, partner, customer, SDK user, or operator?
- Does the doc explain what problem the API solves?
- Are prerequisites, permissions, environments, and setup steps clear?
- Are supported versions and deprecation status visible?
- Are limitations and non-goals documented?

## Correctness and Completeness

- Are endpoint paths, methods, parameters, headers, request bodies, and response bodies accurate?
- Are required vs optional fields clearly marked?
- Are field types, formats, defaults, constraints, and units specified?
- Are examples valid, minimal, and copy-pasteable?
- Are pagination, filtering, sorting, idempotency, and rate limits documented where relevant?

## Auth and Security

- Does the doc explain authentication flow and token handling safely?
- Are required scopes, roles, permissions, and ownership checks clear?
- Are tenant boundaries and resource access rules documented?
- Are secrets excluded from examples?
- Are webhook signatures, replay protection, CORS, CSRF, or mTLS requirements covered when relevant?

## Error Handling

- Are error codes, status codes, error response shapes, and retry guidance documented?
- Does the doc distinguish validation errors, auth errors, rate limits, conflicts, and system failures?
- Are transient vs permanent failures clear?
- Are examples included for common errors?
- Is support/troubleshooting information provided without leaking sensitive internals?

## Compatibility and Versioning

- Are breaking changes identified?
- Is versioning explained for APIs, SDKs, schemas, events, or webhooks?
- Are deprecated fields and replacement fields documented?
- Are backward-compatible extension rules clear?
- Are migration steps provided for changed behavior?

## Developer Experience

- Can a reader complete a basic successful request quickly?
- Are curl, SDK, and realistic examples included when useful?
- Are concepts introduced before advanced details?
- Are names consistent with product, API, and code terminology?
- Are cross-links included for related APIs, guides, and schemas?

## Testing and Reliability

- Are sandbox/test environment instructions available?
- Are rate limits, quotas, timeouts, retries, and idempotency documented?
- Are eventual consistency, async processing, and webhook delivery semantics clear?
- Are observability hooks such as request IDs or correlation IDs documented?
- Are operational expectations clear for production integrations?

## User-Facing Impact

- Does the doc warn about customer-visible behavior changes?
- Are data retention, privacy, and compliance concerns addressed?
- Are support escalation paths or troubleshooting steps included?
- Is the final doc concise enough to be usable under pressure?
