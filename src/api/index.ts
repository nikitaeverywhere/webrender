import "./render";
import "./health-check";
import { registerEndpoint } from "utils";

registerEndpoint({
  method: "GET",
  path: "/",
  handler: (_, res) => {
    res.status(200).send({
      version: "1.0.0",
    });
  },
});
