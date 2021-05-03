import express, { RequestHandler } from "express";
import { json } from "body-parser";
import { log, error } from "./log";

const PORT = process.env.PORT_WEBRENDER || 80;

const app = express();

app.use(json());

app.listen(PORT, () => {
  log(`API is listening on port ${PORT}.`);
});

export const registerEndpoint = ({
  method,
  path,
  handler,
}: {
  method: "GET" | "POST";
  path: string;
  handler: RequestHandler;
}) => {
  const handle = method === "GET" ? app.get : app.post;
  log(`Registered ${method} ${path}`);
  handle.bind(app)(path, async function (...args) {
    const now = Date.now();
    const res = args[1];
    try {
      log(`>> ${method} ${path}`);
      await handler(...args);
    } catch (e) {
      error(`|| ${method} ${path} ${e?.stack || e}`);
      res.status(500).send({
        error: `Unable to handle ${path}: ${e?.message || e}`,
      });
    }
    if (!res.headersSent) {
      res.status(204).end();
    }
    log(
      `<< ${method} ${path} ${res.statusCode || 500} (${Date.now() - now}ms)`
    );
  });
};
