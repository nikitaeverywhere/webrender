export const log = (...args: any) =>
  console.log(...[new Date().toUTCString(), " "].concat(args));
export const error = (...args: any) =>
  console.error(...[new Date().toUTCString(), " "].concat(args));
