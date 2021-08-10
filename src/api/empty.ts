import { registerEndpoint } from "utils";

registerEndpoint({
  log: false,
  method: "GET",
  path: "/empty",
  handler: (_, res) => {
    res.status(200).send("");
  },
});
