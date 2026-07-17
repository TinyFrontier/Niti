# Job Search design system

Foundation v0.1 defines the shared visual language for the product redesign. The living component catalog is available at `/design-system` after signing in.

## Direction

**Career workspace, not generic admin.** The UI should feel focused, calm, and optimistic while remaining efficient for dense CRM workflows.

- Neutral blue-grey surfaces keep long sessions comfortable.
- Indigo is reserved for navigation, focus, and primary actions.
- Semantic feedback colors communicate meaning, never decoration.
- Typography uses a compact scale and strong page hierarchy.
- Layout favors readable content width, deliberate grouping, and generous section spacing.

## Architecture

### 1. Foundation tokens

Tokens live in `src/index.css` and are exposed to Tailwind through `@theme inline`.

- Surface: `background`, `surface`, `surface-raised`, `surface-overlay`
- Content: `foreground`, `muted-foreground`, `subtle-foreground`
- Structure: `border`, `border-strong`, `input`, `ring`
- Brand: `primary`, `primary-hover`, `primary-active`, `primary-subtle`
- Feedback: `success`, `warning`, `info`, `destructive` and their subtle variants
- Shell: `sidebar`, `sidebar-foreground`, `sidebar-muted`, `sidebar-accent`
- Shape/elevation: four radii and three shadow levels

Product code must use semantic utilities such as `bg-warning-subtle` or `text-success`. Do not use palette utilities such as `bg-amber-100`, hex values, or OKLCH values outside the token file.

### 2. Primitives

Shared components live in `src/shared/ui`:

- `Button`: six hierarchy variants and six sizes
- `Badge`: compact semantic state labels
- `Card`: default, muted, outline, and interactive containers
- `Input`, `Select`, `Textarea`, `Label`, `FormField`: one form contract
- `Alert`: contextual semantic feedback
- `EmptyState`, `Skeleton`: system states
- `BrandMark`: one product signature across shell and authentication

### 3. Composition rules

- Use one primary button per action region.
- Use `PageHeader` for every top-level page.
- Use `FormField` to keep label, hint, and error rhythm consistent.
- Use `Badge` for compact state and `Alert` when the user needs context or action.
- Use default cards for content groups, muted cards for secondary groupings, and interactive cards only for clickable objects.
- Keep page-specific layout inside features; visual primitives stay in `shared/ui`.

## Accessibility contract

- Interactive controls have visible keyboard focus.
- Standard controls are at least 40px high; compact controls are only for dense secondary actions.
- Color is paired with text or iconography for status communication.
- Reduced-motion preferences disable non-essential transitions.
- Icon-only buttons require an accessible label.

## Next iteration

1. Migrate repeated feature-level field wrappers to `FormField`.
2. Replace remaining direct palette utilities with semantic tokens.
3. Redesign dashboard information architecture using the new primitives.
4. Add overlay primitives (dialog, dropdown, toast) when product flows require them.
5. Add a dark theme only after the light redesign is stable.
