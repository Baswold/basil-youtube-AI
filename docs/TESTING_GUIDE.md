# Testing Guide 🧪

## Overview

Comprehensive testing infrastructure for the Three-Way Voice Studio with unit tests, integration tests, and E2E tests.

---

## 🏗️ Testing Stack

- **Test Framework**: Vitest (fast, TypeScript-native)
- **Coverage**: V8 coverage provider
- **Mocking**: Vitest built-in mocks
- **Integration**: Socket.IO client for WebSocket testing
- **Assertions**: Expect API (Jest-compatible)

---

## 📦 Installation

```bash
# Install all dependencies (includes test dependencies)
pnpm install

# Backend testing dependencies already included in package.json
```

---

## 🚀 Running Tests

### Backend Tests

```bash
# Run all tests
cd apps/backend
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run only unit tests
pnpm test:unit

# Run integration tests
pnpm test:integration
```

### Quick Test Commands

```bash
# From repo root
pnpm --filter basil-backend test

# Run specific test file
pnpm --filter basil-backend test event-logger.test.ts

# Run tests matching pattern
pnpm --filter basil-backend test recorder
```

---

## 📂 Test Structure

```
apps/backend/src/
├── services/
│   ├── event-logger.ts
│   ├── event-logger.test.ts       ✅ Unit tests
│   ├── recorder.ts
│   ├── recorder.test.ts           ✅ Unit tests
│   ├── briefing-loader.ts
│   └── briefing-loader.test.ts    ✅ Unit tests
├── adapters/
│   ├── mock.ts
│   └── mock.test.ts               ✅ Unit tests
├── config.ts
├── config.test.ts                 ✅ Unit tests
├── orchestrator-v2.ts
└── orchestrator-v2.test.ts        ✅ Integration tests
```

---

## 🧪 Test Coverage

### Services (100% Coverage Target)

#### EventLogger Tests
- ✅ Directory creation
- ✅ Session start/end events
- ✅ Multiple events in sequence
- ✅ Timestamp validation
- ✅ All event types (15+ events)
- ✅ Error logging with stack traces
- ✅ File write error handling

**Test File**: `src/services/event-logger.test.ts`
**Tests**: 12 test cases

#### Recorder Tests
- ✅ Directory creation
- ✅ Audio chunk writing per speaker
- ✅ VTT caption generation
- ✅ Valid VTT format
- ✅ Session metadata (YAML)
- ✅ Model information in metadata
- ✅ Multiple captions in sequence
- ✅ Separate files per speaker
- ✅ Timestamp formatting
- ✅ Stream closing

**Test File**: `src/services/recorder.test.ts`
**Tests**: 13 test cases

#### BriefingLoader Tests
- ✅ Frontmatter parsing
- ✅ Array parsing (mustCover, avoidTopics)
- ✅ Claude system prompt generation
- ✅ Guest system prompt generation
- ✅ No frontmatter handling
- ✅ File listing
- ✅ Non-existent file errors
- ✅ Absolute path handling
- ✅ Tone in prompts
- ✅ Guidelines inclusion

**Test File**: `src/services/briefing-loader.test.ts`
**Tests**: 14 test cases

### Configuration Tests
- ✅ Default values
- ✅ Environment variable parsing
- ✅ API key validation
- ✅ Provider-specific validation
- ✅ CORS origin parsing
- ✅ Port number parsing
- ✅ Optional vs required keys

**Test File**: `src/config.test.ts`
**Tests**: 11 test cases

### Adapter Tests
- ✅ Mock STT adapter creation
- ✅ Mock TTS adapter creation
- ✅ Mock LLM adapter creation
- ✅ Start/stop operations
- ✅ Generation streaming
- ✅ Different adapter IDs

**Test File**: `src/adapters/mock.test.ts`
**Tests**: 10 test cases

### Integration Tests
- ✅ Orchestrator socket registration
- ✅ Initial state sending
- ✅ Hello event handling
- ✅ Autopilot toggle
- ✅ Session cleanup on disconnect
- ✅ Multiple concurrent sessions
- ✅ Graceful shutdown

**Test File**: `src/orchestrator-v2.test.ts`
**Tests**: 8 test cases

---

## 📊 Test Statistics

### Total Tests Written
- **EventLogger**: 12 tests
- **Recorder**: 13 tests
- **BriefingLoader**: 14 tests
- **Configuration**: 11 tests
- **Mock Adapters**: 10 tests
- **Orchestrator Integration**: 8 tests

**Total**: **68 test cases** ✅

### Coverage Goals
- **Services**: 100% coverage target
- **Configuration**: 100% coverage target
- **Adapters**: 80% coverage target (mocking external APIs)
- **Integration**: 70% coverage target

---

## 🔍 Test Examples

### Unit Test Example (EventLogger)

```typescript
it("should log session start event", async () => {
  logger.logSessionStart("session-1", testEpisodeId, { test: true });
  await logger.stop();

  const filePath = path.join(testOutputDir, testEpisodeId, "events.jsonl");
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.trim().split("\n");
  
  expect(lines.length).toBeGreaterThan(0);
  const event = JSON.parse(lines[0]);
  expect(event.type).toBe("session.start");
  expect(event.sessionId).toBe("session-1");
});
```

### Integration Test Example (Orchestrator)

```typescript
it("should handle autopilot toggle", async () => {
  const snapshotPromise = new Promise((resolve) => {
    clientSocket.on("state.snapshot", (snapshot) => {
      if (snapshot.autopilot === true) {
        resolve(snapshot);
      }
    });
  });

  await orchestrator.register(mockSocket);
  clientSocket.emit("client.toggle-autopilot", true);

  const snapshot = await snapshotPromise;
  expect(snapshot).toHaveProperty("autopilot", true);
});
```

---

## 🎯 Test Best Practices

### 1. Arrange-Act-Assert Pattern
```typescript
it("should do something", async () => {
  // Arrange
  const service = new Service();
  await service.start();
  
  // Act
  const result = await service.doSomething();
  
  // Assert
  expect(result).toBe(expected);
});
```

### 2. Cleanup After Tests
```typescript
afterEach(async () => {
  await service.stop();
  await fs.rm(testDir, { recursive: true });
});
```

### 3. Test Isolation
- Each test should be independent
- Use `beforeEach` and `afterEach` for setup/cleanup
- Don't rely on test execution order

### 4. Descriptive Test Names
```typescript
// Good ✅
it("should create VTT caption files with valid timestamps");

// Bad ❌
it("should work");
```

### 5. Test Edge Cases
- Empty inputs
- Invalid inputs
- Error conditions
- Boundary values
- Concurrent operations

---

## 🚨 Common Testing Patterns

### Testing Async Operations
```typescript
it("should handle async operations", async () => {
  await expect(service.asyncMethod()).resolves.toBe(value);
  await expect(service.failingMethod()).rejects.toThrow();
});
```

### Testing File Operations
```typescript
it("should create files", async () => {
  await service.createFile();
  const stats = await fs.stat(filePath);
  expect(stats.isFile()).toBe(true);
});
```

### Testing Events
```typescript
it("should emit events", async () => {
  const promise = new Promise((resolve) => {
    emitter.on("event", resolve);
  });
  
  emitter.trigger();
  
  const result = await promise;
  expect(result).toBeDefined();
});
```

### Testing WebSocket Communication
```typescript
it("should handle WebSocket messages", async () => {
  const messagePromise = new Promise((resolve) => {
    socket.on("message", resolve);
  });
  
  socket.emit("trigger");
  
  const message = await messagePromise;
  expect(message).toHaveProperty("type");
});
```

---

## 📈 Coverage Reports

### Generating Coverage

```bash
pnpm test:coverage
```

### Coverage Output Locations
- **Text Report**: Console output
- **JSON Report**: `coverage/coverage-final.json`
- **HTML Report**: `coverage/index.html`

### Viewing HTML Coverage Report

```bash
# Generate coverage
pnpm test:coverage

# Open in browser
open coverage/index.html
```

### Coverage Thresholds (Future)

```typescript
// vitest.config.ts
coverage: {
  lines: 80,
  functions: 80,
  branches: 75,
  statements: 80,
}
```

---

## 🔧 Troubleshooting Tests

### Test Failures

**Problem**: Tests fail randomly
**Solution**: Check for race conditions, ensure proper cleanup

**Problem**: File permission errors
**Solution**: Ensure test directories are writable

**Problem**: Port already in use (integration tests)
**Solution**: Use dynamic ports or ensure cleanup

### Debugging Tests

```bash
# Run tests with verbose output
pnpm test -- --reporter=verbose

# Run single test file
pnpm test event-logger.test.ts

# Run tests matching pattern
pnpm test -- --grep "should create"

# Run tests in UI mode (if available)
pnpm test -- --ui
```

### Environment Issues

```bash
# Check if dependencies are installed
pnpm install

# Clear test cache
rm -rf node_modules/.vite

# Rebuild TypeScript
pnpm build
```

---

## 🎓 Writing New Tests

### 1. Create Test File
```bash
# Convention: [filename].test.ts
touch src/services/my-service.test.ts
```

### 2. Basic Test Structure
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MyService } from "./my-service";

describe("MyService", () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  afterEach(async () => {
    await service.cleanup();
  });

  it("should do something", () => {
    const result = service.doSomething();
    expect(result).toBe(expected);
  });
});
```

### 3. Run Your Tests
```bash
pnpm test my-service.test.ts
```

---

## 🚀 CI/CD Integration (Future)

### GitHub Actions Example

```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run tests
        run: pnpm --filter basil-backend test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 📝 Test Checklist

Before merging code, ensure:

- [ ] All tests pass
- [ ] New features have tests
- [ ] Edge cases are tested
- [ ] Tests have descriptive names
- [ ] Cleanup is proper
- [ ] No console.log in tests
- [ ] Coverage hasn't decreased

---

## 🎯 Next Steps

### Planned Tests

- [ ] Frontend component tests (React Testing Library)
- [ ] E2E tests (Playwright)
- [ ] Load testing (Artillery/k6)
- [ ] Performance benchmarks
- [ ] Visual regression tests

### Test Infrastructure Improvements

- [ ] Add pre-commit hooks (run tests)
- [ ] Set up coverage thresholds
- [ ] Add mutation testing
- [ ] Set up continuous testing
- [ ] Add test reporting dashboard

---

**Testing is Documentation!** 📚

Well-tested code is self-documenting and easier to maintain.

**Status**: ✅ **68 Tests Written and Ready**
