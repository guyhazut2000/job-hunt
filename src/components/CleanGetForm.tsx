"use client";

/** GET form that leaves empty fields out of the URL (`?q=&role=` → nothing). Still a plain form without JS. */
export function CleanGetForm(props: React.ComponentProps<"form">) {
  return (
    <form
      method="get"
      {...props}
      onSubmit={(e) => {
        for (const el of Array.from(e.currentTarget.elements)) {
          if (
            (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) &&
            el.name &&
            el.value === "" &&
            !(el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox") && !el.checked)
          )
            el.disabled = true;
        }
      }}
    />
  );
}
