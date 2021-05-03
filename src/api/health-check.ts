import { registerEndpoint, PORT } from "utils";
import { openUrl } from "browser";

registerEndpoint({
  log: false,
  method: "GET",
  path: "/health-check",
  handler: async (_, res) => {
    const { result, error } = await openUrl({
      url: `http://localhost:${PORT}/`,
      js: `while (true) {
					   if (document.body.innerHTML.includes('version')) { return 42; }
             await new Promise(r => setTimeout(r, 20));
           }`,
    });
    res.status(result === 42 ? 200 : 500).send({ error, result });
  },
});
