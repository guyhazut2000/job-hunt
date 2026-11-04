"use client";

import { useState, type SelectHTMLAttributes } from "react";

/**
 * Native `<select>` for long option lists (hundreds of applications): until the user focuses or
 * presses on it, only the empty and the selected option are in the DOM. One list per row × 400
 * options was the biggest DOM cost on /referrals (docs/ui-data-density.md). Keyboard type-ahead,
 * screen readers and mobile pickers keep working because it stays a real select.
 */
export function LazySelect({
  value,
  options,
  emptyLabel,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "children"> & {
  value: string;
  options: Array<{ value: string; label: string }>;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const wake = () => setOpen(true);
  const list = open ? options : options.filter((o) => o.value === value);
  return (
    <select {...rest} value={value} onFocus={wake} onPointerDown={wake} onMouseDown={wake} onTouchStart={wake}>
      <option value="">{emptyLabel}</option>
      {list.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
