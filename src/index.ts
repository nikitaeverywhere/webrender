import "./api";
import { closeBrowser } from "./browser";
import { apiReady, stopApi } from "utils";

export const start = async () => {
  await apiReady;
};

export const stop = async () => {
  await stopApi();
  await closeBrowser();
};
