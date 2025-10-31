# Biome Linting Setup

This project uses [Biome](https://biomejs.dev/) for fast, performant linting and formatting across all TypeScript/JavaScript code.

## Installation

Biome is already installed in each workspace (backend, frontend, worker). If you need to reinstall:

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install

# Worker
cd worker && npm install
```

## VS Code Integration

The recommended Biome extension (`biomejs.biome`) is configured in `.vscode/extensions.json`. Install it when prompted, or manually:

1. Open VS Code Extensions (Cmd+Shift+X)
2. Search for "Biome"
3. Install the official Biome extension

The workspace is configured to:
- Use Biome as the default formatter
- Format on save
- Organize imports on save
- Apply quick fixes on save

## Available Commands

Each workspace (backend, frontend, worker) has the following npm scripts:

```bash
# Check for linting errors
npm run lint

# Fix linting errors automatically
npm run lint:fix

# Format code
npm run format
```

## Configuration Files

- `biome.json` in root - Global configuration
- `backend/biome.json` - Backend-specific rules
- `frontend/biome.json` - Frontend-specific rules (includes React/JSX settings)
- `worker/biome.json` - Worker-specific rules

## Linting Rules

The configuration enables:
- ✅ All recommended rules
- ✅ Unused variables and imports detection
- ✅ Const enforcement
- ✅ Template literal suggestions
- ⚠️ `any` type warnings
- ✅ Import organization
- ✅ Accessibility checks (frontend only)

## Formatting Style

- **Indent**: 2 spaces
- **Line width**: 100 characters
- **Quotes**: Single quotes (double for JSX)
- **Semicolons**: Always
- **Trailing commas**: Always
- **Arrow parentheses**: Always

## CI/CD Integration

To add Biome checks to your CI pipeline, add to your GitHub Actions or similar:

```yaml
- name: Lint Backend
  run: cd backend && npm run lint

- name: Lint Frontend
  run: cd frontend && npm run lint

- name: Lint Worker
  run: cd worker && npm run lint
```

## Migration from ESLint/Prettier

Biome replaces both ESLint and Prettier with a single, faster tool. The old configuration files can be removed:
- `.eslintrc.*`
- `.prettierrc.*`
- `.eslintignore`
- `.prettierignore`

## Tips

- Run `npm run lint` before committing to catch issues early
- Use `npm run lint:fix` to auto-fix most issues
- The VS Code extension provides real-time feedback as you type
- Check the [Biome docs](https://biomejs.dev/) for advanced configuration options
