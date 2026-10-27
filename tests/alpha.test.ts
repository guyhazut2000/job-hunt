import { describe, expect, it } from "vitest";
import { groupByLetter, letterAnchor, letterOf } from "@/lib/alpha";

describe("letterOf", () => {
  it("uppercases Latin and ignores leading punctuation/diacritics", () => {
    expect(letterOf("wix")).toBe("W");
    expect(letterOf('  "Árbe" Robotics')).toBe("A");
    expect(letterOf("(eToro)")).toBe("E");
  });
  it("maps Hebrew, including final forms and niqqud", () => {
    expect(letterOf("רפאל")).toBe("ר");
    expect(letterOf("ךלום")).toBe("כ");
    expect(letterOf("שָׁלוֹם")).toBe("ש");
  });
  it("puts digits and symbols under #", () => {
    expect(letterOf("3M")).toBe("#");
    expect(letterOf("")).toBe("#");
    expect(letterOf("@home")).toBe("H");
  });
});

describe("groupByLetter", () => {
  it("orders Latin, then Hebrew, then #, sorting within groups", () => {
    const names = ["Zebra", "apple", "Amdocs", "אלביט", "בזק", "8200 Alumni", "Check Point"];
    const g = groupByLetter(names, (n) => n);
    expect(g.map((x) => x.letter)).toEqual(["A", "C", "Z", "א", "ב", "#"]);
    expect(g[0].items).toEqual(["Amdocs", "apple"]);
  });
  it("makes safe anchors", () => {
    expect(letterAnchor("A")).toBe("letter-A");
    expect(letterAnchor("#")).toBe("letter-other");
    expect(letterAnchor("א")).toBe("letter-he-1");
  });
});
