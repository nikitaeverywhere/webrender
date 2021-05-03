import { registerEndpoint } from "utils";

registerEndpoint({
  method: "GET",
  path: "/health-check",
  handler: (_, res) => {
    res.status(200).send();
  },
});
