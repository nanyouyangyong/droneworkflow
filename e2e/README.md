# E2E Tests

This directory contains end-to-end tests using Playwright.

## Test Files

### auth.spec.ts
Tests complete authentication flows:
- User registration with validation
- User login with valid/invalid credentials
- Session persistence after page refresh
- Logout functionality
- Navigation between login and register pages
- Password visibility toggle

### workflow-creation.spec.ts
Tests workflow creation from chat:
- Creating workflow from chat message
- Displaying chat history
- Starting new chat sessions
- Changing AI models
- Sending messages with Enter key
- Multi-line input with Shift+Enter
- Empty message validation
- Streaming response display

### workflow-execution.spec.ts
Tests workflow execution and monitoring:
- Executing workflows and displaying logs
- Real-time execution logs via Socket.IO
- Workflow execution status display
- Stopping workflow execution
- Displaying workflow nodes in canvas
- Editing workflow nodes
- Workflow persistence after refresh
- Execution history

## Running E2E Tests

### Prerequisites
1. Ensure the backend server is running (or will be started automatically)
2. Install Playwright browsers if not already installed:
   ```bash
   npx playwright install
   ```

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run E2E Tests with UI
```bash
npm run test:e2e:ui
```

### Run Specific Test File
```bash
npx playwright test e2e/auth.spec.ts
```

### Run in Headed Mode (see browser)
```bash
npx playwright test --headed
```

### Debug Tests
```bash
npx playwright test --debug
```

## Notes

- The Playwright config automatically starts the dev server (`npm run dev`) before running tests
- Tests use `test.skip()` for scenarios where UI elements may not be present (e.g., workflow not generated)
- Each test suite logs in before running tests to ensure authenticated state
- Tests clear localStorage/sessionStorage before each test for isolation
- Default timeout is set in playwright.config.ts
- Tests run in Chromium by default (can be extended to Firefox, WebKit)

## Test Strategy

These E2E tests focus on critical user journeys:
1. **Authentication**: Complete registration and login flows
2. **Workflow Creation**: Chat-based workflow generation
3. **Workflow Execution**: Running workflows and monitoring logs

Tests are designed to be resilient to timing issues and gracefully skip when expected UI elements are not present.
