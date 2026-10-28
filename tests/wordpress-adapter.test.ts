import { describe, expect, it, vi } from "vitest";
import { parseWordPressBoard, wordpressAdapter } from "@/lib/ingestion/adapters/wordpress";

// Shape of https://www.one1.co.il/wp-json/wp/v2/job (trimmed).
const posts = [
  {
    id: 3603,
    date: "2026-10-21T09:47:03",
    modified: "2026-10-21T09:47:03",
    link: "https://www.one1.co.il/job/rf-engineer/",
    title: { rendered: "מהנדס/ת מערכות תקשורת סלולארית &#8211; אזור תל אביב (SK27794)" },
    content: { rendered: "" },
    "job-category": [263],
    region: [295, 301, 344],
    jobscope: [287],
  },
  {
    id: 3604,
    date: "2026-10-25T12:54:16",
    modified: "2026-10-26T08:00:00",
    link: "https://www.one1.co.il/job/devops/",
    title: { rendered: "DevOps Engineer לחברה מובילה (NM27783)" },
    content: { rendered: "<p>Kubernetes, Terraform</p>" },
    "job-category": [259],
    region: [344],
    jobscope: [287],
  },
];
const terms: Record<string, { id: number; name: string }[]> = {
  "job-category": [
    { id: 263, name: "סקטור ביטחוני" },
    { id: 259, name: "DevOps &amp; Cloud" },
  ],
  region: [
    { id: 295, name: "גוש דן" },
    { id: 301, name: "דרום" },
    { id: 344, name: "ירושלים והסביבה" },
  ],
  jobscope: [{ id: 287, name: "משרה מלאה" }],
};

function fakeFetch() {
  return vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    const type = url.pathname.split("/").pop()!;
    if (type === "job") {
      return url.searchParams.get("page") === "1"
        ? new Response(JSON.stringify(posts))
        : new Response(JSON.stringify({ code: "rest_post_invalid_page_number" }), { status: 400 });
    }
    return new Response(JSON.stringify(terms[type] ?? []));
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe("WordPress careers adapter", () => {
  it("parses boardId as host[/postType]", () => {
    expect(parseWordPressBoard("www.one1.co.il")).toEqual({ host: "www.one1.co.il", postType: "job" });
    expect(parseWordPressBoard("Example.co.il/positions")).toEqual({ host: "example.co.il", postType: "positions" });
    expect(() => parseWordPressBoard("https://evil/x?y")).toThrow();
  });

  it("fetches the job post type, resolves taxonomies and normalizes", async () => {
    const fetchImpl = fakeFetch();
    const raws = await wordpressAdapter.fetchRaw({ boardId: "www.one1.co.il", fetchImpl });
    expect(raws).toHaveLength(2);
    expect(raws[1]._regions).toEqual(["ירושלים והסביבה"]);
    const [a, b] = raws.map((r) => wordpressAdapter.normalize(r)!);
    // Entities decoded; city from the title wins over a multi-region tag list.
    expect(a.title).toBe("מהנדס/ת מערכות תקשורת סלולארית – אזור תל אביב (SK27794)");
    expect(a.location).toBe("Tel Aviv");
    expect(a.externalId).toBe("www.one1.co.il:3603");
    expect(a.source).toBe("WORDPRESS");
    expect(a.department).toBe("סקטור ביטחוני");
    expect(a.applyUrl).toBe("https://www.one1.co.il/job/rf-engineer/");
    // A single region tag is used as the location.
    expect(b.location).toBe("Jerusalem");
    expect(b.department).toBe("DevOps & Cloud");
    expect(b.techStack).toEqual(expect.arrayContaining(["Kubernetes", "Terraform"]));
    expect(wordpressAdapter.isInIsrael(raws[0])).toBe(true);
    const urls = fetchImpl.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toBe("https://www.one1.co.il/wp-json/wp/v2/job?per_page=100&page=1");
    expect(urls.some((u) => u.includes("/wp-json/wp/v2/region?"))).toBe(true);
  });
});
