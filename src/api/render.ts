import { openUrl } from "browser";
import { PORT, registerEndpoint } from "utils";

registerEndpoint({
  method: "POST",
  path: "/render",
  handler: async (req, res) => {
    const { url, js, jsOn, timeout, takePdfSnapshot } = req.body || {};

    if (typeof url !== "string") {
      return res.status(400).send({
        error:
          'Please, specify "url" parameter in the request body, or use an empty string to render a blank page.',
        errorCode: "BAD_REQUEST",
      });
    }
    if (typeof js !== "undefined" && typeof js !== "string") {
      return res.status(400).send({
        error:
          'Please, specify valid "js" string parameter in the request body.',
        errorCode: "BAD_REQUEST",
      });
    }
    if (
      typeof jsOn !== "undefined" &&
      (typeof jsOn !== "string" ||
        !["commit", "domcontentloaded", "load"].includes(jsOn))
    ) {
      return res.status(400).send({
        error: 'Invalid "jsOn" parameter in the request body.',
        errorCode: "BAD_REQUEST",
      });
    }
    if (
      typeof timeout !== "undefined" &&
      (typeof timeout !== "number" || timeout <= 0)
    ) {
      return res.status(400).send({
        error: 'Please, specify valid "timeout" parameter in the request body.',
        errorCode: "BAD_REQUEST",
      });
    }

    const result = await openUrl({
      url: url || `http://localhost:${PORT}/empty`,
      js,
      jsOn: jsOn as any, // Validated above
      timeout,
      takePdfSnapshot: !!takePdfSnapshot,
    });

    const isError = "error" in result;
    res.status(isError ? 500 : 200).send(
      isError
        ? {
            error: result.error,
            errorCode: result.errorCode || "UNKNOWN",
            url,
            result: null,
          }
        : {
            url: result.url,
            result: result.result ?? null,
            pdfSnapshot: result.pdfSnapshotBase64,
          }
    );
  },
});
