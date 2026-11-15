# Domain docs

## Before exploring

Read `CONTEXT.md` at the repository root. Read relevant decisions in `docs/adr/`. If a `CONTEXT-MAP.md` is added later, follow it to the relevant context documents.

If these files do not exist, proceed without creating them upfront. Create domain docs only when a domain term or decision is actually resolved.

## Layout

This repository uses a single context:

- `CONTEXT.md` for the shared domain glossary.
- `docs/adr/` for architectural decisions.

## Vocabulary

Use the terms from `CONTEXT.md` in issue titles, plans, and code. Avoid terms that the glossary explicitly rejects. If a needed concept is missing, note the gap rather than inventing a competing term.

## ADR conflicts

Surface conflicts with relevant ADRs instead of silently overriding them.
