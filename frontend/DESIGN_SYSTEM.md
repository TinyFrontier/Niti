# Niti design system

Foundation v0.2 defines the shared visual language for the product redesign. The living component catalog is available at `/design-system` after signing in.

## Reference principles

The system uses the ecosystem the team likes:

- **Kumo:** the runtime component library and theme engine. Versioned components provide Base UI accessibility, semantic surfaces, responsive sidebar, overlays and form controls.
- **shadcn/ui + Efferd:** optional source-owned blocks when Kumo has no suitable product composition.
- **Bklit:** a dedicated visualization layer with reusable chart utilities instead of one-off SVG/CSS charts.
- **XYFlow:** reserved for a future interactive application pipeline or relationship map where node-based interaction creates real product value.

`components.json` remains available for exceptional shadcn/Efferd blocks and the `@bklit` registry. Registry code must be reviewed before use; it is not the default primitive layer.

## Direction

**Niti is a career workspace, not generic admin.** The UI should feel focused, calm, and optimistic while remaining efficient for dense CRM workflows.

- Neutral blue-grey surfaces keep long sessions comfortable.
- Niti blue (`#2B69EE`) is reserved for navigation, focus, and primary actions.
- Semantic feedback colors communicate meaning, never decoration.
- Typography uses a compact scale and strong page hierarchy.
- Layout favors readable content width, deliberate grouping, and generous section spacing.

## Architecture

### 1. Foundation tokens

Kumo owns the canonical light/dark semantic tokens. Product aliases live in `src/index.css` and are exposed to Tailwind through `@theme inline`.

- Surface: `background`, `surface`, `surface-raised`, `surface-overlay`
- Content: `foreground`, `muted-foreground`, `subtle-foreground`
- Structure: `border`, `border-strong`, `input`, `ring`
- Brand: `primary`, `primary-hover`, `primary-active`, `primary-subtle`
- Feedback: `success`, `warning`, `info`, `destructive` and their subtle variants
- Data visualization: `chart-1` through `chart-5`, ordered by emphasis
- Shell: `sidebar`, `sidebar-foreground`, `sidebar-muted`, `sidebar-accent`
- Shape/elevation: four radii and three shadow levels

Product code must use semantic utilities such as `bg-warning-subtle` or `text-success`. Do not use palette utilities such as `bg-amber-100`, hex values, or OKLCH values outside the token file.

### 2. Primitives

Runtime primitives come from `@cloudflare/kumo`. Files in `src/shared/ui` are compatibility adapters that preserve the current feature API while delegating rendering and interaction to Kumo:

- Kumo `Button`, `Badge`, `LayerCard`, `Input`, `Select`, `Textarea`, `Label`, `Field`, `Banner`, `Empty`, `SkeletonLine`
- Kumo `Sidebar` for desktop, collapsed and mobile navigation
- Kumo `DropdownMenu` for the theme selector
- `BrandMark` remains product-owned because it represents identity rather than a reusable UI primitive

## Theme modes

`ThemeProvider` supports `light`, `dark`, and `system`, persists the choice in `localStorage`, reacts to OS theme changes, and applies Kumo's `data-mode` contract before React starts to prevent a flash of the wrong theme.

### 3. Composition rules

- Use one primary button per action region.
- Use `PageHeader` for every top-level page.
- Use `FormField` to keep label, hint, and error rhythm consistent.
- Use `Badge` for compact state and `Alert` when the user needs context or action.
- Use default cards for content groups, muted cards for secondary groupings, and interactive cards only for clickable objects.
- Keep page-specific layout inside features; visual primitives stay in `shared/ui`.

## Accessibility contract

- Interactive controls have visible keyboard focus.
- Use Kumo's base size for desktop forms and `lg` for prominent or touch-first actions; compact sizes are only for dense secondary actions.
- Color is paired with text or iconography for status communication.
- Reduced-motion preferences disable non-essential transitions.
- Icon-only buttons require an accessible label.

## Next iteration

1. Migrate repeated feature-level field wrappers to Kumo's integrated `label`, `description`, and `error` props.
2. Replace the temporary native-option compatibility API with direct `Select.Option` usage feature by feature.
3. Redesign dashboard information architecture using Kumo cards and Bklit charts.
4. Adopt Kumo dialogs, tooltips and toasts as the related product flows are redesigned.
5. Validate whether the application pipeline needs Kumo `Flow` or the richer XYFlow canvas.
