# Security Hardening Notes

## Runtime configuration

Set these variables in production:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `AUTH_COOKIE_NAME`
- `CSRF_COOKIE_NAME`

Do not rely on development defaults in production.

## API hardening applied

- `helmet` enabled.
- CORS restricted to configured origins.
- Global and auth-specific rate limits enabled.
- Request body size limit enabled.
- Centralized error handler returns safe messages with `x-request-id`.
- Zod request validation for auth/cards/purchases/deposits endpoints.
- CSRF protection for unsafe authenticated methods.
- Auth moved to HTTP-only cookie with SameSite and Secure in production.

## Dependency and supply-chain checks

- Backend production dependency audit is clean at `high` level.
- Frontend production dependency audit reduced significantly after removing `react-scripts`.
- CI workflow includes build/lint/test and `pnpm audit --prod` checks.

## Operational recommendations

- Rotate `JWT_SECRET` on environment changes.
- Keep `POSTGRES_PASSWORD` out of repository and CI logs.
- Prefer short-lived auth sessions and periodic credential rotation.
- Review audit output regularly and patch moderate findings in maintenance windows.
