# Tefsen Web Accessibility & Keyboard Contract

Tefsen Web should remain usable with a keyboard and understandable to assistive technology without requiring a mouse or touch screen.

Step 38 establishes the baseline contract for the authenticated Web app.

## Skip navigation

`app/index.html` provides a keyboard-visible:

`Skip to main content`

link targeting:

`#app-main`

The loading screen, sign-in screen and authenticated shell all provide the same stable, focusable main target.

The skip link is visually hidden until focused.

## Live regions

The entire `#app-root` is **not** a live region.

Large route rerenders should not cause a screen reader to announce the whole application repeatedly.

Targeted status feedback remains available through the existing toast live region.

Form/field validation messages are normalized to polite status regions when rendered.

## Dialog semantics

Any element rendered as `.modal` inside `#modal-root` is normalized to:

- `role="dialog"`
- `aria-modal="true"`
- a programmatic accessible name from its first heading when one is not already supplied
- `tabindex="-1"` fallback
- accessible labels for icon-only close buttons

This normalization also covers older modal markup that did not originally include complete ARIA attributes.

## Focus when a dialog opens

When a dialog opens:

1. Tefsen remembers the element that had focus.
2. Background application content becomes inert.
3. The skip link becomes inert.
4. Dialog semantics/form labels are normalized.
5. Focus moves inside the dialog.

Form dialogs prefer the first visible form control. Confirmation/menu dialogs fall back to the first interactive control or the dialog itself.

## Keyboard trap

While a dialog is open:

- `Tab` stays inside the dialog.
- `Shift+Tab` wraps from the first focusable element to the last.
- `Tab` wraps from the last focusable element to the first.
- `Escape` closes the dialog.

Dialog keyboard handling runs before global keyboard shortcuts.

## Focus restoration

When a dialog closes, Tefsen removes the inert background state and returns focus to the element that opened the dialog when that element is still connected to the page.

If the route changed and the old control no longer exists, Tefsen does not force focus onto a stale node.

## Form labels and validation

Rendered `.field` groups are normalized so their first label and first input/select/textarea are programmatically associated.

If a control has no ID, Tefsen creates a runtime-unique ID and applies it to the label's `for` attribute.

Validation containers using:

- `.form-error`
- `.field-error`

receive polite status semantics so updates can be announced without turning the entire page into a live region.

## Navigation semantics

The active desktop and mobile navigation control exposes:

`aria-current="page"`

The secondary account/saved navigation has an explicit accessible label.

The global search field exposes the keyboard shortcut:

- Control+K
- Meta+K

and the visible hint reads:

`Ctrl/⌘ K`

## Visible focus

Tefsen retains the existing global `:focus-visible` treatment for interactive controls.

The skip link has its own high-contrast focused state.

Do not remove visible keyboard focus merely for visual styling.

## Regression expectations

CI should continue proving that:

1. the skip link and `#app-main` target remain present
2. `#app-root` is not a whole-app live region
3. dialog role/name/close-button normalization remains active
4. background content becomes inert while dialogs are open
5. Tab/Shift+Tab remain trapped
6. Escape closes the active dialog before other shortcuts
7. focus restoration remains present
8. form labels and error status semantics remain normalized
9. active navigation exposes `aria-current`
10. the global search shortcut remains exposed to assistive technology
