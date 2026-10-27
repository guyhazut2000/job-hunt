import type { AtsProvider } from "@prisma/client";
import { comeetAdapter } from "./adapters/comeet";
import { greenhouseAdapter } from "./adapters/greenhouse";
import { leverAdapter } from "./adapters/lever";
import type { AtsAdapter } from "./types";

const adapters: Partial<Record<AtsProvider, AtsAdapter<unknown>>> = {
  GREENHOUSE: greenhouseAdapter as AtsAdapter<unknown>,
  LEVER: leverAdapter as AtsAdapter<unknown>,
  COMEET: comeetAdapter as AtsAdapter<unknown>,
};

export function getAdapter(provider: AtsProvider): AtsAdapter<unknown> | undefined {
  return adapters[provider];
}

export const SUPPORTED_PROVIDERS = Object.keys(adapters) as AtsProvider[];
