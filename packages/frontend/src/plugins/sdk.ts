import { inject, type InjectionKey, type Plugin } from "vue";

import { type FrontendSDK } from "@/types";

const KEY: InjectionKey<FrontendSDK> = Symbol("FrontendSDK");

// Provides the FrontendSDK to the Vue app.
export const SDKPlugin: Plugin = (app, sdk: FrontendSDK) => {
  app.provide(KEY, sdk);
};

// Access the FrontendSDK from within a component.
export const useSDK = () => {
  return inject(KEY) as FrontendSDK;
};
