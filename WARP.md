# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Runtime & Package Manager

This project uses **Bun** (v1.3.2+) as both the JavaScript runtime and package manager. Bun is significantly faster than Node.js/npm for most operations.

## Essential Commands

### Installation
```bash
bun install
```

### Running the Application
```bash
bun run index.ts
```

### Development
```bash
# Run any TypeScript file directly
bun run <filename>.ts
```

## TypeScript Configuration

This project uses strict TypeScript settings with modern bundler-mode resolution:
- **Target**: ESNext with bundler module resolution
- **Strict mode**: Enabled with additional safety checks (`noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`)
- **No emit**: TypeScript is used only for type checking; Bun handles execution directly
- **Module system**: Preserve mode with `allowImportingTsExtensions` enabled

When writing code:
- Import TypeScript files with `.ts` extensions (e.g., `import { foo } from "./module.ts"`)
- Leverage strict null checks and indexed access checks
- Use JSX syntax with `react-jsx` transform if needed

## Project Structure

This is a minimal Bun-based API project currently in early development stages:
- **Entry point**: `index.ts` - main application file
- **Configuration**: `tsconfig.json` - TypeScript compiler options
- **Dependencies**: Managed via `package.json` with `@types/bun` for type definitions

## Testing

No test framework is currently configured. When adding tests, consider using Bun's built-in test runner:
```bash
bun test
```

Test files should follow the naming convention `*.test.ts` or `*.spec.ts`.

## Code Style

- Follow the strict TypeScript rules defined in `tsconfig.json`
- Use modern ES module syntax
- Leverage Bun-specific APIs when appropriate for performance
