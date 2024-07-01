import { registerEndpoint } from "utils";
import "./empty";
import "./health-check";
import "./render";

registerEndpoint({
  log: false,
  method: "GET",
  path: "/",
  handler: (req, res) => {
    res.status(200).send({
      version: "1.0.0",
      headers: Object.fromEntries(Object.entries(req.headers)),
    });
  },
});
