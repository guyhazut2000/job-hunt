import type { AtsProvider } from "@prisma/client";
import { ashbyAdapter } from "./adapters/ashby";
import { comeetAdapter } from "./adapters/comeet";
import { greenhouseAdapter } from "./adapters/greenhouse";
import { leverAdapter } from "./adapters/lever";
import { recruiteeAdapter } from "./adapters/recruitee";
import { smartRecruitersAdapter } from "./adapters/smartrecruiters";
import { workableAdapter } from "./adapters/workable";
import { workdayAdapter } from "./adapters/workday";
import type { AtsAdapter } from "./types";

const adapters: Partial<Record<AtsProvider, AtsAdapter<unknown>>> = {
  GREENHOUSE: greenhouseAdapter as AtsAdapter<unknown>,
  LEVER: leverAdapter as AtsAdapter<unknown>,
  COMEET: comeetAdapter as AtsAdapter<unknown>,
  ASHBY: ashbyAdapter as AtsAdapter<unknown>,
  WORKABLE: workableAdapter as AtsAdapter<unknown>,
  SMARTRECRUITERS: smartRecruitersAdapter as AtsAdapter<unknown>,
  RECRUITEE: recruiteeAdapter as AtsAdapter<unknown>,
  WORKDAY: workdayAdapter as AtsAdapter<unknown>,
};

export function getAdapter(provider: AtsProvider): AtsAdapter<unknown> | undefined {
  return adapters[provider];
}

export const SUPPORTED_PROVIDERS = Object.keys(adapters) as AtsProvider[];
