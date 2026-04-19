# Sidebar Organization — Design Spec

**Date:** 2026-04-18  
**Status:** Approved

## Context

The current sidebar renders all CLI commands as a single flat list. The underlying command catalog already organizes commands into 5 groups (Observability, Configuration, Operations, Maintenance, Security), but that structure is invisible in the UI. As the command count grows, the flat list becomes harder to scan and navigate. This redesign surfaces the existing group structure to make the sidebar more organized and easier to use.

## Decision

Replace the flat sidebar list with a two-level navigation:

1. **Sub-nav bar** — a horizontal tab bar added between the top nav and the app body, showing the 5 group names
2. **Filtered sidebar** — the sidebar shows only the commands for the currently selected group

## Layout

```
┌─────────────────────────────────────────────────────┐
│ Top Nav: swarm-cli wordmark · cluster info · toggle  │
├─────────────────────────────────────────────────────┤
│ Sub-nav: Observability · Configuration · [Operations]│  ← new
│                            · Maintenance · Security  │
├──────────────────┬──────────────────────────────────┤
│ Sidebar          │ Main Canvas                       │
│ ── Operations ── │                                   │
│ > List Nodes     │  Command bar / args               │
│   List Services  │  Stat cards                       │
│   Inspect Svc    │  Node roster / activity feed      │
│   …              │                                   │
│                  │                                   │
│ [Setup Wizard]   │                                   │
└──────────────────┴──────────────────────────────────┘
```

## Behavior

- **Active group** — highlighted in the sub-nav with the existing cyan underline style; sidebar label shows the group name
- **Group switching** — clicking a group tab updates the sidebar and **auto-selects the first command** in that group
- **Default group on load** — Operations (largest group, most common use)
- **Active command** — existing cyan highlight + left border, unchanged
- **Setup Wizard footer** — remains at the bottom of the sidebar, unchanged
- **Collapsed sidebar** — at ≤900px the sidebar still collapses to icon-only; the sub-nav bar remains visible and functional

## Files to Change

| File | Change |
|------|--------|
| `packages/ui/app/page.tsx` | Add sub-nav bar between `<header>` and `<div className="app-body">`; pass `selectedGroup` state to `SidebarNav` |
| `packages/ui/components/command-center.tsx` | Update `SidebarNav` to accept `selectedGroup` prop and filter commands to that group |
| `packages/ui/app/globals.css` | Add `.sub-nav`, `.sub-nav-tab`, `.sub-nav-tab.active` styles |

## State

New `selectedGroup` state in `page.tsx` (string, default `"operations"`):

- Set on sub-nav tab click
- Passed to `SidebarNav` as prop
- When changed, also sets `selectedCommandId` to the first command in the new group

## What Does NOT Change

- Command execution logic (`command-bridge.ts`, `command-runtime.ts`)
- Main canvas components (node roster, activity feed, result viewer, stat cards)
- The 5 group definitions in `packages/core/src/catalog.ts`
- Icon mapping in `command-center.tsx`
- Mobile behavior (sidebar hidden at ≤640px)
