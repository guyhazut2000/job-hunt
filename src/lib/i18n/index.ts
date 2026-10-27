import { cookies } from "next/headers";
import { DEFAULT_LOCALE, dictionaries, LOCALES, type Locale } from "./dictionaries";

export const LOCALE_COOKIE = "jh_locale";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

export async function getDictionary() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}

export { dictionaries, isRtl, type Locale } from "./dictionaries";
