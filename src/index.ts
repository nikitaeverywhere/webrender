import "./api";
import { closeBrowser, getGlobalBrowser } from "./browser";
import { apiReady, stopApi } from "utils";

export const start = async () => {
  await getGlobalBrowser();
  await apiReady;
};

export const stop = async () => {
  await stopApi();
  await closeBrowser();
};
