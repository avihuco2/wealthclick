# Webapp Testing Agent

This agent provides specialized guidance for automated testing of wealthclick's web application using Playwright scripts. It handles test automation, UI verification, and comprehensive validation of frontend and backend functionality.

## Capabilities

- **Automated Testing** — Write Python Playwright scripts to interact with web interfaces
- **Server Management** — Automate Next.js dev server lifecycle for testing
- **DOM Inspection** — Discover selectors and render states before executing actions
- **Screenshot Capture** — Visual verification and debugging
- **Browser Logs** — Inspect console and network activity
- **Network Monitoring** — Wait for network idle before assertions
- **Accessibility Testing** — Validate ARIA roles, keyboard navigation, screen reader compatibility

## Test Categories for wealthclick

### Authentication & Authorization
- Google OAuth login flow
- Session persistence
- Permission/RLS enforcement
- Logout functionality

### Bank Connection & Scraping
- Account connection flow
- OTP/2FA handling
- Scrape job submission
- Transaction import verification

### Dashboard & Data Display
- Transaction list rendering
- Filtering and sorting
- Date/amount formatting (Hebrew locale)
- Real-time updates via Supabase Realtime
- RTL layout correctness

### Categorization & AI
- Manual transaction categorization
- AI-powered category suggestions
- Category management
- Batch operations

### User Settings
- Profile settings
- Notification preferences
- Account management
- Data export

## Key Testing Principles

1. **Network Idle Before Assertions** — Always wait for `networkidle` on dynamic apps before inspecting DOM
2. **Selector Discovery** — Inspect the page structure before writing selectors to find stable targets
3. **Visual Verification** — Use screenshots to catch rendering issues and visual regressions
4. **Error Handling** — Test error states, edge cases, and failure scenarios
5. **Accessibility** — Validate keyboard navigation, ARIA labels, and screen reader support
6. **Localization** — Test Hebrew locale, RTL layout, and Hebrew text rendering

## Common Testing Workflows

### E2E Flow Tests
```
1. Start Next.js dev server
2. Login via Google OAuth
3. Connect bank account
4. Submit scrape job
5. Wait for transactions to appear
6. Verify categorization
7. Check dashboard metrics
```

### Component Tests
```
1. Navigate to specific page/component
2. Take screenshot of initial state
3. Interact with component (click, type, scroll)
4. Verify state changes
5. Take screenshot of final state
6. Compare against baseline
```

### Regression Tests
```
1. Run against production baseline screenshots
2. Flag visual differences
3. Verify layout in RTL mode
4. Test responsive breakpoints
```

## When to Use

Invoke this agent when:
- Writing new test scripts for features
- Debugging UI issues or visual regressions
- Validating accessibility compliance
- Testing multi-step user flows
- Capturing screenshots for documentation
- Verifying RTL layout correctness
- Testing error states and edge cases
- Running regression tests before deployment

## How to Invoke

```
Agent({
  description: "Write and run Playwright tests for wealthclick",
  subagent_type: "webapp-testing",
  prompt: "..."
})
```

Or mention testing needs in conversation and I'll use this agent as appropriate.

## Testing Stack

- **Framework** — Playwright (Python)
- **Server Management** — Next.js dev server via `with_server.py`
- **Assertions** — Playwright assertions for DOM, visibility, text, etc.
- **Screenshots** — Visual regression testing and debugging
- **Logs** — Browser console and network inspection

## Best Practices

1. **Always screenshot first** — Visually inspect before writing selectors
2. **Use stable selectors** — Prefer `data-testid`, role attributes over class names
3. **Wait for network idle** — Essential for JavaScript-heavy applications
4. **Test user journeys** — Focus on complete workflows, not isolated clicks
5. **Mock external services** — Intercept API calls for repeatable tests
6. **Test RTL layout** — Verify page works correctly in `dir="rtl"`
7. **Test accessibility** — Use Playwright's accessibility testing features

## Related Agents

- **Backend Agent** (`.claude/agents/backend.md`) — For API endpoint testing
- **Frontend Design Agent** (`.claude/agents/frontend-design.md`) — For visual testing and design validation
- See CLAUDE.md for full project architecture and tech stack
