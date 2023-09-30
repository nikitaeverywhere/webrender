import { json } from "body-parser";
import express, { RequestHandler } from "express";
import { error, log as logToConsole } from "./log";

let resolveApiReady: (value?: unknown) => void = () => {};

export const PORT = process.env.PORT_WEBRENDER || 8080;
export const apiReady = new Promise((r) => (resolveApiReady = r));

const app = express();

app.use(
  json({
    limit: "10mb",
  })
);

const server = app.listen(PORT, () => {
  logToConsole(`API is listening on port ${PORT}.`);
  resolveApiReady();
});

export const stopApi = async () => {
  return new Promise((resolve) =>
    server.close(() => {
      logToConsole(`API server is closed.`);
      resolve(void 0);
    })
  );
};

export const registerEndpoint = ({
  method,
  path,
  handler,
  log = true,
}: {
  method: "GET" | "POST";
  path: string;
  handler: RequestHandler;
  log?: boolean;
}) => {
  const handle = method === "GET" ? app.get : app.post;

  logToConsole(`Registered ${method} ${path} (log: ${log})`);

  handle.bind(app)(path, async function (...args) {
    const now = Date.now();
    const res = args[1];
    try {
      if (log) {
        logToConsole(`>> ${method} ${path}`);
      }
      await handler(...args);
    } catch (e: any) {
      error(`|| ${method} ${path} ${e?.stack || e}`);
      res.status(500).send({
        error: `Unable to handle ${path}: ${e?.message || e}`,
        errorCode: "UNKNOWN",
      });
    }
    if (!res.headersSent) {
      res.status(204).end();
    }
    if (log) {
      logToConsole(
        `<< ${method} ${path} ${res.statusCode || 500} (${Date.now() - now}ms)`
      );
    }
  });
};
