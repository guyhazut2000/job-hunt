import type { AtsProvider } from "@prisma/client";
import { amazonAdapter } from "./adapters/amazon";
import { ashbyAdapter } from "./adapters/ashby";
import { comeetAdapter } from "./adapters/comeet";
import { eightfoldAdapter } from "./adapters/eightfold";
import { greenhouseAdapter } from "./adapters/greenhouse";
import { jibeAdapter } from "./adapters/jibe";
import { leverAdapter } from "./adapters/lever";
import { oracleHcmAdapter } from "./adapters/oracle-hcm";
import { recruiteeAdapter } from "./adapters/recruitee";
import { smartRecruitersAdapter } from "./adapters/smartrecruiters";
import { successFactorsAdapter } from "./adapters/successfactors";
import { workableAdapter } from "./adapters/workable";
import { wordpressAdapter } from "./adapters/wordpress";
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
  WORDPRESS: wordpressAdapter as AtsAdapter<unknown>,
  EIGHTFOLD: eightfoldAdapter as AtsAdapter<unknown>,
  ORACLE_HCM: oracleHcmAdapter as AtsAdapter<unknown>,
  JIBE: jibeAdapter as AtsAdapter<unknown>,
  AMAZON: amazonAdapter as AtsAdapter<unknown>,
  SUCCESSFACTORS: successFactorsAdapter as AtsAdapter<unknown>,
};

export function getAdapter(provider: AtsProvider): AtsAdapter<unknown> | undefined {
  return adapters[provider];
}

export const SUPPORTED_PROVIDERS = Object.keys(adapters) as AtsProvider[];
