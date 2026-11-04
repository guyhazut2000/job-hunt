# System design and AI-native prep (`/learn/system-design`, #118)

Static, public pages (like `/learn/problem-solving`), all content in
`src/lib/sysdesign/content.ts` with a source on every section.

| Route                            | Content                                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/learn/system-design`           | 45-minute method with time per step, what a senior answer shows, frontend (RADIO) variant, cheat sheet (scale, data, cache, async, frontend), latency orders of magnitude. |
| `/learn/system-design/questions` | 12 questions filterable by `?kind=` frontend / fullstack / backend / ai: what to clarify, the core of the answer, a common mistake.                                        |
| `/learn/system-design/ai`        | 8 AI-native topics: LLM integration, RAG, prompts, evals, cost & latency, safety (OWASP LLM Top 10 2025), agents, governance (NIST AI RMF).                                |

The minute split is a suggested plan, not a statistic. Latency values are orders of magnitude only,
cited to the "Latency numbers every programmer should know" page.

## Sources

System Design Primer, _Designing Data-Intensive Applications_, Hello Interview (delivery framework),
GreatFrontEnd (RADIO), roadmap.sh system design / AI engineer (link only), Colin Scott latency
numbers, web.dev Core Web Vitals, MDN HTTP caching, Lewis et al. RAG (arXiv 2005.11401), Gemini /
OpenAI / Anthropic docs, Anthropic "Building effective agents", Hamel Husain on evals, OWASP Top 10
for LLM Applications 2025, NIST AI RMF.

Linked from the "More" menu, `/learn/gaps` (practice links) and the question pages link to
`/interview` for a mock round.
