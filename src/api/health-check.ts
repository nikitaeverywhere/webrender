import { openUrl } from "browser";
import { PORT, registerEndpoint } from "utils";

registerEndpoint({
  log: false,
  method: "GET",
  path: "/health-check",
  handler: async (_, res) => {
    const result = await openUrl({
      url: `http://localhost:${PORT}/`,
      jsOn: "domcontentloaded",
      js: `while (true) {
					   if (document.body.innerHTML.includes('version')) { return 42; }
             await new Promise(r => setTimeout(r, 20));
           }`,
    });
    const isError = "error" in result;
    res.status(isError ? 500 : 200).send(result);
  },
});
