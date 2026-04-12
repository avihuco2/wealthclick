# Frontend Design Agent

This agent provides specialized guidance for building Apple-inspired interfaces for WealthClick—a personal finance app. It prioritizes clean aesthetics, delightful micro-interactions, and intentional design choices that make financial management feel effortless.

## Design Philosophy (Apple-Inspired)

- **Simplicity** — Remove unnecessary elements, focus on essentials
- **Typography** — Clean, readable system fonts (SF Pro)
- **Color** — Minimal palette with purposeful accents (blue #007AFF)
- **Spacing** — Generous whitespace, 8px grid system
- **Motion** — Subtle animations (200-300ms) that delight without distracting
- **Micro-interactions** — Delightful feedback on every interaction
- **Accessibility** — Works perfectly for everyone (WCAG AA compliant)

## When to Use

Invoke this agent when:
- Building new UI components or pages that need distinctive visual identity
- Refining existing interfaces for aesthetic excellence
- Making design decisions around typography, color, spacing, and motion
- Creating landing pages, dashboards, or marketing interfaces
- Ensuring design consistency and intentionality across the application

## How to Invoke

Use in Claude Code conversations or as a specialized agent when building frontend features:
```
Agent({
  description: "Build a distinctive, production-grade component/page",
  subagent_type: "frontend-design",
  prompt: "..."
})
```

## Design System

### Color Palette
- **Primary** — `#007AFF` (Apple Blue) for CTAs, highlights
- **Success** — `#34C759` (Apple Green) for positive states
- **Warning** — `#FF9500` (Apple Orange) for alerts
- **Danger** — `#FF3B30` (Apple Red) for destructive actions
- **Background** — `#F5F5F7` (Light) / `#1D1D1D` (Dark, future)
- **Text** — `#1D1D1D` (Dark) / `#F5F5F7` (Light, future)
- **Secondary Text** — `#8E8E93` (Gray)

### Typography
- **Font Stack** — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`
- **Headlines** — SF Pro Display (20-32px, font-weight 600-700)
- **Body** — SF Pro Text (16-18px, font-weight 400)
- **Small Text** — 14px, font-weight 400, color #8E8E93

### Components
- **Buttons** — Rounded corners (8px), padding 12-16px, subtle shadows
- **Cards** — White background, shadow `0 1px 3px rgba(0,0,0,0.1)`, 8px radius
- **Input Fields** — Border 1px #D1D1D6, focus ring #007AFF, padding 12px
- **Lists** — Dividers 1px #D1D1D6, padding 16px
- **Navigation** — Sticky top, background with backdrop-blur

### Spacing (8px Grid)
- 4px (half grid)
- 8px, 16px, 24px, 32px, 40px, 48px

### Animations
- **Transition** — 200-300ms, ease-in-out
- **Hover** — Subtle scale (98-102%), opacity shift
- **Loading** — Skeleton screens (preferred over spinners)
- **Feedback** — Toast notifications (brief, auto-dismiss)

## WealthClick-Specific Components

### Dashboard
- Large, readable transaction list
- At-a-glance balance display
- Category breakdown (pie/bar chart)
- Monthly trends
- Call-to-action for adding transactions

### Transaction Details
- Large amount display
- Description with optional notes
- Category tag (changeable)
- Date/time
- Related transactions

### Add/Edit Transaction
- Minimal form (amount, description, category)
- Calendar picker for date
- Category suggestions
- Clear save/cancel buttons

## Key Principle

**Form follows function.** Every design choice serves the user's goal of understanding and managing their finances. No decorative flourishes—only intentional details that enhance clarity and delight.
