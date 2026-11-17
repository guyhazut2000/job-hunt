import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { navigationStrings } from "@/lib/i18n/navigation";
import { userIdentity, userInitials } from "@/lib/ui/user-identity";
import { UserAvatar } from "@/components/UserAvatar";

describe("user identity for the header button", () => {
  it("uses the first and last name for initials, in Hebrew and Latin", () => {
    expect(userInitials("Guy Hazut")).toBe("GH");
    expect(userInitials("גיא חזות")).toBe("גח");
    expect(userInitials("  dana  ")).toBe("D");
    expect(userInitials("Anna Maria Lopez")).toBe("AL");
    expect(userInitials('"Moshe" Cohen')).toBe("MC");
  });

  it("falls back to the email when there is no name", () => {
    expect(userInitials(null, "guy.hazut@example.com")).toBe("GH");
    expect(userInitials("", "demo@job-hunt.local")).toBe("D");
    expect(userInitials(null, null)).toBe("?");
  });

  it("shows the name, or the email's local part", () => {
    expect(userIdentity({ name: "Guy", email: "g@x.io" }).displayName).toBe("Guy");
    expect(userIdentity({ name: " ", email: "demo@job-hunt.local" }).displayName).toBe("demo");
    expect(userIdentity({ email: " demo@job-hunt.local " }).email).toBe("demo@job-hunt.local");
  });

  it("only accepts http(s) or same-origin avatar images", () => {
    expect(userIdentity({ email: "a@b.c", image: "https://cdn.example.com/a.png" }).image).toBe(
      "https://cdn.example.com/a.png",
    );
    expect(userIdentity({ email: "a@b.c", image: "/avatars/a.png" }).image).toBe("/avatars/a.png");
    expect(userIdentity({ email: "a@b.c", image: "javascript:alert(1)" }).image).toBeNull();
    expect(userIdentity({ email: "a@b.c", image: "//evil.example/a.png" }).image).toBeNull();
    expect(userIdentity({ email: "a@b.c", image: null }).image).toBeNull();
  });
});

describe("UserAvatar", () => {
  it("renders initials without an image and an <img> with one", () => {
    const initials = renderToStaticMarkup(createElement(UserAvatar, { image: null, initials: "גח" }));
    expect(initials).toContain("גח");
    expect(initials).not.toContain("<img");
    const img = renderToStaticMarkup(createElement(UserAvatar, { image: "https://x.io/a.png", initials: "GH" }));
    expect(img).toContain('<img src="https://x.io/a.png"');
  });
});

describe("user menu strings", () => {
  it("has every label in Hebrew and English", () => {
    const he = navigationStrings("he").userMenu;
    const en = navigationStrings("en").userMenu;
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
    for (const v of [...Object.values(he), ...Object.values(en)]) expect(v.length).toBeGreaterThan(0);
    expect(he.openFor).toContain("{name}");
    expect(en.openFor).toContain("{name}");
  });
});
