# GGA Setup Guide - Gentleman Guardian Angel

This guide explains how to set up and use Gentleman Guardian Angel (GGA) for automated code review in the park-pos project.

## What is GGA?

Gentleman Guardian Angel is an AI-powered code review tool that automatically validates your code against the project's coding standards defined in `AGENTS.md`. It runs on every commit via git hooks and in CI/CD pipelines to catch violations early.

## Installation

### Option 1: Homebrew (Recommended)

```bash
brew install gentleman-programming/tap/gga
```

### Option 2: Manual Installation

```bash
git clone https://github.com/Gentleman-Programming/gentleman-guardian-angel.git
cd gentleman-guardian-angel
./install.sh
```

### Verify Installation

```bash
gga version
# Should output: gga v2.7.0 (or later)
```

## Configuration

### 1. AI Provider Setup

GGA requires an AI provider to analyze code. We use Claude by default.

**Set up your API key:**

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
export ANTHROPIC_API_KEY="your-api-key-here"

# Or create a .env file (not committed to git)
echo "ANTHROPIC_API_KEY=your-api-key-here" >> .env
```

**Get an API key:**
- Visit https://console.anthropic.com/
- Create an account or sign in
- Generate an API key
- Add credits to your account

### 2. Install Git Hooks

Run the installation script from the project root:

```bash
./scripts/install-gga-hooks.sh
```

This installs two hooks:
- **pre-commit**: Validates code before commit
- **commit-msg**: Validates commit message format

### 3. Verify Configuration

```bash
gga config
```

Should show:
```
Current Configuration:

Config Files:
  Project: .gga

Values:
  PROVIDER:          claude
  FILE_PATTERNS:     *.ts,*.tsx
  EXCLUDE_PATTERNS:  *.test.ts,*.spec.ts,...
  RULES_FILE:        AGENTS.md
  STRICT_MODE:       true
  TIMEOUT:           300s

Rules File: Found
```

## Validated Rules

GGA validates the following rules from `AGENTS.md`:

### Money Handling (Critical)
- ✅ Money values use `Centavos` branded type
- ❌ Float or decimal types for money
- ✅ Database money columns use `Int` type

**Example violation:**
```typescript
// ❌ BAD
const price: number = 25.50;

// ✅ GOOD
const price: Centavos = 2550; // S/. 25.50
```

### Security (Critical)

#### Tenant ID
- ✅ `tenant_id` from JWT: `authResult.user.tenantId`
- ❌ `tenant_id` from request body or client input

**Example violation:**
```typescript
// ❌ BAD
const tenantId = req.body.tenant_id;

// ✅ GOOD
const tenantId = authResult.user.tenantId;
```

#### Admin Roles
- ✅ Use `ADMIN_ROLES.includes(role)`
- ❌ Direct comparison `role === 'ADMIN'`

**Example violation:**
```typescript
// ❌ BAD - excludes OWNER, MANAGER, SUPERVISOR
if (role === 'ADMIN') { ... }

// ✅ GOOD - includes all admin roles
if (ADMIN_ROLES.includes(role)) { ... }
```

#### Sensitive Data Logging
- ❌ Never log PIN or mac_address in console.log
- ✅ Use structured logger (Pino)

**Example violation:**
```typescript
// ❌ BAD
console.log('User PIN:', user.pin);

// ✅ GOOD
import { createLogger } from '@/src/core/observability/logger';
const logger = createLogger('auth');
logger.info({ userId: user.id }, 'User authenticated');
```

#### API Authentication
- ✅ All API routes use auth middleware
- ❌ Unauthenticated routes

**Example violation:**
```typescript
// ❌ BAD
export async function POST(req: Request) { ... }

// ✅ GOOD
export const POST = requirePosAuth(async (req, authResult) => { ... });
```

### Database Patterns

#### PrismaClient Singleton
- ✅ Import from `@/src/core/db/prisma`
- ❌ Create new instance with `new PrismaClient()`

**Example violation:**
```typescript
// ❌ BAD
const prisma = new PrismaClient();

// ✅ GOOD
import prisma from '@/src/core/db/prisma';
```

#### Test Cleanup
- ✅ Use `deleteMany({ where: { tenant_id } })`
- ❌ Use `deleteMany({})` without filter

**Example violation:**
```typescript
// ❌ BAD - deletes all data across tenants
await prisma.order.deleteMany({});

// ✅ GOOD - only deletes test tenant data
await prisma.order.deleteMany({ where: { tenant_id: testTenantId } });
```

### Logging Patterns
- ✅ Use Pino structured logger
- ❌ Use console.log

**Example violation:**
```typescript
// ❌ BAD
console.log('Order created:', orderId);

// ✅ GOOD
import { createLogger } from '@/src/core/observability/logger';
const logger = createLogger('orders');
logger.info({ orderId }, 'Order created');
```

## Usage

### Automatic Review (Pre-commit Hook)

GGA runs automatically when you commit:

```bash
git add src/api/orders.ts
git commit -m "feat: add order creation endpoint"

# GGA will review your changes
# ✅ If no violations: commit proceeds
# ❌ If violations found: commit blocked with details
```

### Manual Review

Run GGA manually on staged files:

```bash
git add .
gga run
```

### CI/CD Review

GGA runs automatically on pull requests via GitHub Actions. Check the workflow status in the PR.

## Emergency Bypass

In urgent situations, you can bypass GGA checks:

```bash
git commit --no-verify -m "hotfix: critical production issue"
```

**⚠️ Warning:** Only use this for genuine emergencies. Bypassed code should be reviewed and fixed ASAP.

## Troubleshooting

### "GGA not found"

**Problem:** Hook can't find the `gga` command.

**Solution:**
```bash
# Check if GGA is installed
which gga

# If not found, install it
brew install gentleman-programming/tap/gga

# Verify it's in your PATH
echo $PATH
```

### "ANTHROPIC_API_KEY not set"

**Problem:** AI provider credentials not configured.

**Solution:**
```bash
# Set the API key
export ANTHROPIC_API_KEY="your-api-key-here"

# Add to shell profile for persistence
echo 'export ANTHROPIC_API_KEY="your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

### "Timeout waiting for AI response"

**Problem:** GGA times out (default: 300 seconds).

**Solution:**
```bash
# Increase timeout in .gga file
TIMEOUT="600"

# Or set via environment variable
GGA_TIMEOUT=600 gga run
```

### "Ambiguous AI response"

**Problem:** AI provider returns unclear analysis.

**Solution:**
1. Review the code manually
2. Refine AGENTS.md rules to be more explicit
3. Temporarily disable strict mode in `.gga`:
   ```bash
   STRICT_MODE="false"
   ```

### False Positive

**Problem:** GGA flags valid code as violation.

**Solution:**
1. Review the violation carefully
2. If incorrect, clarify the rule in AGENTS.md
3. Use `--no-verify` for immediate bypass
4. Report the issue to improve rules

### CI Workflow Fails

**Problem:** GitHub Actions workflow fails with GGA errors.

**Solution:**
1. Check that `ANTHROPIC_API_KEY` is set in repository secrets:
   - Go to Settings → Secrets and variables → Actions
   - Add `ANTHROPIC_API_KEY` secret
2. Verify the workflow has permissions to comment on PRs
3. Check workflow logs for specific errors

## Cache Management

GGA caches review results for unchanged files.

### View Cache Status

```bash
gga cache status
```

### Clear Cache

```bash
# Clear project cache
gga cache clear

# Clear all cache (all projects)
gga cache clear-all
```

### Cache Invalidation

Cache automatically invalidates when:
- `AGENTS.md` changes
- `.gga` configuration changes
- File content changes

## Advanced Configuration

### Using Different AI Providers

Edit `.gga` to change providers:

```bash
# Use Gemini
PROVIDER="gemini"

# Use Ollama with local model
PROVIDER="ollama:codellama"

# Use GitHub Models
PROVIDER="github:gpt-4o"
```

### Custom File Patterns

Edit `.gga` to change which files are reviewed:

```bash
# Review only API routes
FILE_PATTERNS="src/app/api/**/*.ts"

# Exclude more patterns
EXCLUDE_PATTERNS="*.test.ts,*.mock.ts,*.stories.tsx"
```

### PR Review Mode

Review all files in a PR (not just last commit):

```bash
gga run --pr-mode
```

Review with diffs only (faster, cheaper):

```bash
gga run --pr-mode --diff-only
```

## Support

For issues or questions:
1. Check this guide's troubleshooting section
2. Review GGA documentation: https://github.com/Gentleman-Programming/gentleman-guardian-angel
3. Ask the team in #dev-tools Slack channel
4. Open an issue in the park-pos repository

## Summary

GGA helps maintain code quality by:
- ✅ Catching violations before commit
- ✅ Enforcing consistent coding standards
- ✅ Providing immediate feedback to developers
- ✅ Reducing manual code review burden
- ✅ Preventing common security issues

Happy coding! 🎉
