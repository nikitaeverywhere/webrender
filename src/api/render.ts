import { openUrl } from "browser";
import { log, PORT, registerEndpoint } from "utils";

registerEndpoint({
  method: "POST",
  path: "/render",
  handler: async (req, res) => {
    const { url, js, timeout, waitAfterResourcesLoad, takePdfSnapshot } =
      req.body || {};

    if (typeof url !== "string") {
      return res.status(400).send({
        error: 'Please, specify "url" parameter in the request body.',
      });
    }
    if (typeof js !== "string") {
      return res
        .status(400)
        .send({ error: 'Please, specify "js" parameter in the request body.' });
    }
    if (typeof timeout !== "undefined" && typeof timeout !== "number") {
      return res.status(400).send({
        error: 'Please, specify "timeout" parameter in the request body.',
      });
    }
    if (
      typeof waitAfterResourcesLoad !== "undefined" &&
      typeof waitAfterResourcesLoad !== "number"
    ) {
      return res.status(400).send({
        error:
          'Please, specify "waitAfterResourcesLoad" parameter in the request body.',
      });
    }

    const result = await openUrl({
      url: url || `http://localhost:${PORT}/empty`,
      js,
      timeout,
      waitAfterResourcesLoad,
      takePdfSnapshot: !!takePdfSnapshot,
    });

    log(`|| Rendering ${url}`);
    res.status(result.error ? 500 : 200).send({
      ...result,
    });
  },
});
