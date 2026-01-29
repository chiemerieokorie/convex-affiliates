## [2.0.2](https://github.com/chiemerieokorie/convex-affiliates/compare/v2.0.1...v2.0.2) (2026-01-29)

### Bug Fixes

* use generic ctx type for auth callbacks + typed pagination ([f49557e](https://github.com/chiemerieokorie/convex-affiliates/commit/f49557e0496c89ed33fd1a97eb217dac8a7d853c))

## [2.0.1](https://github.com/chiemerieokorie/convex-affiliates/compare/v2.0.0...v2.0.1) (2026-01-29)

### Bug Fixes

* align component boundary types with consumer codegen output ([4ceb104](https://github.com/chiemerieokorie/convex-affiliates/commit/4ceb104c7a39f92e899b2088abd0016c83867ba2))

## [2.0.0](https://github.com/chiemerieokorie/convex-affiliates/compare/v1.1.4...v2.0.0) (2026-01-29)

### ⚠ BREAKING CHANGES

* registerRoutes() and createStripeWebhookHandler() are
no longer standalone exports. Use them as methods on the object returned
by createAffiliateApi() instead.

### Features

* move registerRoutes and webhook handler into createAffiliateApi ([a4437f8](https://github.com/chiemerieokorie/convex-affiliates/commit/a4437f81265dc7cc69b53e887e713197c0c903af))

## [1.1.4](https://github.com/chiemerieokorie/convex-affiliates/compare/v1.1.3...v1.1.4) (2026-01-29)

### Bug Fixes

* use internal visibility in generated component types ([0e061af](https://github.com/chiemerieokorie/convex-affiliates/commit/0e061afaccc1e30c544a31065103a36127cd1e1f))

## [1.1.3](https://github.com/chiemerieokorie/convex-affiliates/compare/v1.1.2...v1.1.3) (2026-01-29)

### Bug Fixes

* remove UseApi type to fix component boundary return type mismatch ([9ccbb4b](https://github.com/chiemerieokorie/convex-affiliates/commit/9ccbb4bb0d1e2e27de0c8a70d996d19e7b4be2cb))

## [1.1.2](https://github.com/chiemerieokorie/convex-affiliates/compare/v1.1.1...v1.1.2) (2026-01-29)

### Bug Fixes

* remove npm whoami from prepublishOnly for OIDC compatibility ([5c530a0](https://github.com/chiemerieokorie/convex-affiliates/commit/5c530a043b7e48c3578d1712f73614f2cff03366))

## [1.1.1](https://github.com/chiemerieokorie/convex-affiliates/compare/v1.1.0...v1.1.1) (2026-01-29)

### Bug Fixes

* add workflow_dispatch trigger to release workflow ([c8586b9](https://github.com/chiemerieokorie/convex-affiliates/commit/c8586b967364e80201adca115b7ffd8b81cdce1d))
* update CLAUDE.md with OIDC publishing docs and commit message rules ([3300f88](https://github.com/chiemerieokorie/convex-affiliates/commit/3300f886e8e9b8f68c057a30c4bcfbc88abb6c0d))

## [1.1.1](https://github.com/chiemerieokorie/convex-affiliates/compare/v1.1.0...v1.1.1) (2026-01-29)

### Bug Fixes

* update CLAUDE.md with OIDC publishing docs and commit message rules ([3300f88](https://github.com/chiemerieokorie/convex-affiliates/commit/3300f886e8e9b8f68c057a30c4bcfbc88abb6c0d))

## [1.1.0](https://github.com/chiemerieokorie/convex-affiliates/compare/v1.0.1...v1.1.0) (2026-01-29)

### Features

* add pkg-pr-new, CI concurrency, and prepublish auth check ([a2e2741](https://github.com/chiemerieokorie/convex-affiliates/commit/a2e2741880cfb0cf793fe9db1f4f19e4b21a2e78))

## [1.0.1](https://github.com/chiemerieokorie/convex-affiliates/compare/v1.0.0...v1.0.1) (2026-01-29)

### Bug Fixes

* remove codegen from prepublishOnly script ([4e3cc08](https://github.com/chiemerieokorie/convex-affiliates/commit/4e3cc081addf3dcfae96760bdda05e06900d73af))

## 1.0.0 (2026-01-29)

### ⚠ BREAKING CHANGES

* Remove Stripe Connect automated payouts and all Stripe SDK dependencies.

This redesign transforms the component into a pure data layer that host apps
can integrate with any payment provider.

Changes:
- Delete internal/connect.ts, internal/stripe.ts, internal/workflows.ts
- Remove stripe npm dependency (no more "use node" blockers)
- Add internal mutations for host app webhook handlers:
  - commissions.createFromInvoice - create commission from invoice data
  - commissions.reverseByCharge - reverse commission on refund
  - referrals.linkStripeCustomer - link Stripe customer to referral
  - payouts.record - record manual payouts
- Remove stripeConnectAccountId/stripeConnectStatus from affiliates schema
- Simplify payout methods: manual, bank_transfer, paypal, other
- Update createAffiliateApi() to remove Stripe-related methods
- Update README with new architecture documentation
- Update example app for affiliate component

Migration: Host apps now handle Stripe webhooks and call component mutations.
See README for webhook integration examples.
* simplify API with createAffiliateApi() factory function

### Features

* add CLI init command to scaffold affiliate setup ([51e7715](https://github.com/chiemerieokorie/convex-affiliates/commit/51e771593c0055a69b4704b5c59f6002a231a3e7))
* add configurable storage for affiliate tracking ([7b32e72](https://github.com/chiemerieokorie/convex-affiliates/commit/7b32e7285b12eabcb89f894e6165866f6feca26c))
* add explicit duplicate customer detection ([086b9d8](https://github.com/chiemerieokorie/convex-affiliates/commit/086b9d81c2af9d4626ea756ded3682e0bd94cad6))
* add IP-based click velocity limiting ([6b92323](https://github.com/chiemerieokorie/convex-affiliates/commit/6b92323b1e701f221a7b4edaba20f95db1073390))
* add notification hooks for affiliate events ([8e1ad65](https://github.com/chiemerieokorie/convex-affiliates/commit/8e1ad656f794d9ea7932d82f90870465b2303177))
* add self-referral fraud prevention ([a6e23b7](https://github.com/chiemerieokorie/convex-affiliates/commit/a6e23b7c1d321b1eeb098baa5f35f0047d1f8f1a))
* add two-sided referral rewards ([87d625f](https://github.com/chiemerieokorie/convex-affiliates/commit/87d625f1ef8fa0f02b640437766c27ada564b223))
* add type-safe @convex-dev/stripe integration with handler merging ([1657017](https://github.com/chiemerieokorie/convex-affiliates/commit/1657017ea2b095de232ec559f202a19d9e663a18))
* add UseApi mapped type for visibility-agnostic component usage ([2d7b062](https://github.com/chiemerieokorie/convex-affiliates/commit/2d7b0626f1ffe16fd3d4f206750537a934b2665f))
* expose component functions as public for host app type access ([0f8a6ef](https://github.com/chiemerieokorie/convex-affiliates/commit/0f8a6ef82a74d7b748a6f4fee24296b6e93535f6))
* initial commit - Convex affiliate marketing component v1.0.0 ([20569c4](https://github.com/chiemerieokorie/convex-affiliates/commit/20569c468d5a197d8a46516073d9c43794becb95))
* remove Stripe SDK, convert to pure data layer ([0576a88](https://github.com/chiemerieokorie/convex-affiliates/commit/0576a88b1e93707997828c77093d6ab7cc800ddb))
* simplify API with createAffiliateApi() factory function ([70d2a2a](https://github.com/chiemerieokorie/convex-affiliates/commit/70d2a2ae865ac1bf4beeee7910fb5112dd745d42))

### Bug Fixes

* add NPM_TOKEN to release workflow for npm publishing ([d222a42](https://github.com/chiemerieokorie/convex-affiliates/commit/d222a42e59d88ad2693663123078b833e72b91ce))
* add referral expiry check and clean up unreachable code ([eb4052c](https://github.com/chiemerieokorie/convex-affiliates/commit/eb4052ca59b66221103a54b06098b205f9699915))
* close self-referral fraud prevention gaps ([7131eb5](https://github.com/chiemerieokorie/convex-affiliates/commit/7131eb55b7ac6dae512c90180e6d972164a8739c))
* exclude .examples from lint and fix React hook deps ([a5c1836](https://github.com/chiemerieokorie/convex-affiliates/commit/a5c1836b5475be0f298aae5f52d0b803df156727))
* improve component integration DX with build cleanup and validation ([45a5882](https://github.com/chiemerieokorie/convex-affiliates/commit/45a5882c43426fc7a0a38cc9c870b87e26570b83))
* prevent user re-attribution via new Stripe customer ID ([e823d9f](https://github.com/chiemerieokorie/convex-affiliates/commit/e823d9f15133c4967b41308ee34d085ef0a57b1a))
* regenerate package-lock.json for CI compatibility ([7bbe138](https://github.com/chiemerieokorie/convex-affiliates/commit/7bbe13852101dcf4b673e3120adb576c5351ce75))
* remove @convex-dev/stripe dependency to avoid duplicate type issues ([737d31b](https://github.com/chiemerieokorie/convex-affiliates/commit/737d31b43e53841356e55336c0f9636c16d9a7f5))
* replace custom rate limiting with @convex-dev/rate-limiter component ([453fc3f](https://github.com/chiemerieokorie/convex-affiliates/commit/453fc3fa12b73998241d4123b73e7fc9dd492caf))
* resolve lint errors and remove unimplemented payout hooks ([7dec325](https://github.com/chiemerieokorie/convex-affiliates/commit/7dec325f6cdcaf2215bc34afbe1f32c087b39315))
* resolve merge conflicts in campaigns.ts ([b8fb18b](https://github.com/chiemerieokorie/convex-affiliates/commit/b8fb18b6d59b4c9b3d9836c489ae397cbf896a07))
* update CI to Node 25.x and regenerate lockfile ([d258564](https://github.com/chiemerieokorie/convex-affiliates/commit/d258564af4d70194035c5162185726aa970eedfc))
* use --legacy-peer-deps in CI to resolve octokit version conflict ([e849bca](https://github.com/chiemerieokorie/convex-affiliates/commit/e849bcaa8d1872376abd8ce0e3041c0181270ced))
* use build instead of build:clean in release workflow ([b884ab4](https://github.com/chiemerieokorie/convex-affiliates/commit/b884ab4a501b67baf692cb7079e6fcb2e26f6931))
* use legacy-peer-deps in release workflow and update lockfile ([75237ed](https://github.com/chiemerieokorie/convex-affiliates/commit/75237edeea63753fa9d770acd17eae7203287bc6))
* use string validators for IDs at component boundary ([4467c9c](https://github.com/chiemerieokorie/convex-affiliates/commit/4467c9c232c8d3f37146668d6c4be5cc044df3aa))

# Changelog

## 0.0.0

- Initial release.
