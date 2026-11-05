import type { PickerRules } from "@/lib/documents/picker";

/** CV and cover letter are one each. The cap stays under a typical ATS attachment limit. */
export const APPLY_PICKER_RULES: PickerRules = {
  maxPerType: { CV: 1, COVER_LETTER: 1 },
  maxTotal: 8,
  maxTotalBytes: 8 * 1024 * 1024,
};
