import type { KeyboardEvent, MouseEvent } from "react";

export interface ClickableOptions {
  /** ARIA role announced for the element. Defaults to `button`. */
  role?: "button" | "link" | "option" | "tab" | "menuitem" | "switch";
  /** Accessible name, when the element's own text is not descriptive. */
  label?: string;
  /** Renders the element unfocusable and announces it as disabled. */
  disabled?: boolean;
}

/**
 * Props that make a non-semantic element (a `div`, `li`, `tr`, card wrapper…)
 * operable by keyboard as well as mouse.
 *
 * A bare `onClick` on a `div` is invisible to keyboard and switch users: the
 * element takes no focus and responds to no key, so the action behind it is
 * unreachable. That fails WCAG 2.2 AA 2.1.1 (Keyboard) and 4.1.2 (Name, Role,
 * Value), and Section 508 §E207.2 by reference.
 *
 * Spreading these props supplies the three things the element is missing —
 * a role, a tab stop, and Enter/Space activation:
 *
 * ```tsx
 * <li {...clickable(() => openArticle(id), { label: "Read article" })}>
 * ```
 *
 * Prefer a real `<button>` when the element is genuinely a button; reach for
 * this helper when the click target is a layout element that cannot become
 * one without breaking its styling or its parent's semantics.
 *
 * Key events that bubble up from a nested control are ignored, so a text
 * input or menu inside the clickable region keeps its own key handling.
 */
export function clickable<T extends HTMLElement = HTMLElement>(
  onActivate: (event: MouseEvent<T> | KeyboardEvent<T>) => void,
  options: ClickableOptions = {},
) {
  const { role = "button", label, disabled = false } = options;
  return {
    role,
    tabIndex: disabled ? -1 : 0,
    "aria-label": label,
    "aria-disabled": disabled || undefined,
    onClick: (event: MouseEvent<T>) => {
      if (disabled) return;
      onActivate(event);
    },
    onKeyDown: (event: KeyboardEvent<T>) => {
      if (disabled) return;
      // Only the element itself activates — a keypress that bubbled out of a
      // nested input or menu belongs to that control.
      if (event.target !== event.currentTarget) return;
      // `link` role follows the native anchor contract: Enter only.
      const keys = role === "link" ? ["Enter"] : ["Enter", " ", "Spacebar"];
      if (!keys.includes(event.key)) return;
      // Space would scroll the page; Enter would submit a surrounding form.
      event.preventDefault();
      onActivate(event);
    },
  };
}

/**
 * Keyboard half of {@link clickable}, for elements that already carry a role
 * and a tab stop and only need Enter/Space to fire the existing `onClick`.
 */
export function onActivateKey<T extends HTMLElement = HTMLElement>(
  onActivate: (event: KeyboardEvent<T>) => void,
) {
  return (event: KeyboardEvent<T>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
    event.preventDefault();
    onActivate(event);
  };
}
