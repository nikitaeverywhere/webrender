# webrender • a fast container for rendering the Web

[![Test and deploy](https://github.com/ZitRos/webrender/actions/workflows/test-and-deploy.yaml/badge.svg)](https://github.com/ZitRos/webrender/actions/workflows/test-and-deploy.yaml)
![Docker Image Size (latest)](https://img.shields.io/docker/image-size/zitros/webrender)
![GitHub](https://img.shields.io/github/license/ZitRos/webrender)

This is a [docker container](https://hub.docker.com/r/zitros/webrender) exposing a simple
yet powerful API for quick websites rendering. Optimized for speed of rendering, in comparison
to [zitros/prerender](https://hub.docker.com/r/zitros/prerender).

```
docker pull zitros/webrender
```

+ Always production-ready and as light as possible.
+ Get any data from rendered pages with arbitrary async JavaScript.
+ Render PDF snapshots of the webpage or assemble your own with JavaScript.
+ Using [Playwright](https://github.com/microsoft/playwright) with Chromium under the hood.

## API

This container exposes its API on port `8080`. Example: `http://this-container:8080/health-check`.

+ Request body type (for POST requests): `application/json`
+ Response body type (for all endpoints): `application/json`

### `GET /health-check`

Endpoint for checking whether this container is healthy. It will render a dummy page served on localhost
under the hood and return status `200` when all right.

### `POST /render`

Renders the page as if it was opened in Chrome browser, optionally invoking custom async JavaScript
provided as a `"js"` parameter.

+ A result of a custom async JavaScript invocation (`"js"` and `"jsOn"` parameters) is returned in the response as `"result"`.
+ A result of the PDF generation (`"takePdfSnapshot"` parameter) is returned in the response as `"pdfSnapshot"`.

Request body:

```js
{
  /** REQUIRED. URL of the page to render. Empty string means "blank" page. */
  "url": "https://www.google.com/search?q=cats&tbm=isch",

  /** OPTIONAL. Timeout for the rendering task. Defaults to 20 seconds. */
  "timeout": 20000,

  /** OPTIONAL. When specified, also returns a base64-encoded "pdfSnapshot" property in the response. */
  "takePdfSnapshot": true,

  /**
   * OPTIONAL. You can specify when to run a JS snippet, if given.
   * 
   * - "commit" (default) => before the page is even created (init script)
   * - "domcontentloaded" => after the html document was parsed
   * - "load" => after the page contents is fully loaded, including async scripts
   */
  "jsOn": "commit",

  /**
   * OPTIONAL. An arbitrary JavaScript code to be invoked in ASYNC CONTEXT in the browser, immediately
   * when page starts loading. Once this code returns, WebRender will immediately close the page and
   * return the result which is equal to a serializable value of what was returned. 
   */
  "js": ` // This code is specified as a template string for this example readability. It should use standard JSON notation.
    let firstCat;
    while (true) {
      if (firstCat = document.querySelector('div[jsaction] div[jsaction] img')) {
        return { cat: firstCat.src }; // As soon as this code returns, /render will respond with the result.
      }
      await new Promise(resolve => setTimeout(resolve, 50)); // Sleep for 50ms
    }
  `,

  /**
   * OPTIONAL. Extra headers to send with browser requests.
   * @see https://playwright.dev/docs/api/class-browsercontext#browser-context-set-extra-http-headers
   */
  "extraHttpHeaders": {
    "Authorization": "Bearer EXAMPLE==="
  }
}
```

In request's `"js"`, you can use the following utility functions in the global context:

```js
/**
 * Allows to wait until the network becomes idle. Handy to determine when the page is fully loaded. Mind that some pages can do infinite http polling.
 * Resolves when there are no more pending network requests within idleTimeout, but resolveBeforeRenderingTimeout before the global timeout.
 */
const { isTimeout } = await webrender.pendingRequests({
  /** OPTIONAL. Number of milliseconds to wait between network requests. Defaults to 2000. */
  idleTimeout: 2000,
  /** OPTIONAL. Number of milliseconds to resolve before the rendering timeout. Defaults to 2000. */
  resolveBeforeRenderingTimeout: 2000,
});
// `isTimeout` equals to true if the waiting time was a timeout.
```


Response body example when request succeeds:

```json
{
  /* Requested URL. */
  "url": "https://www.google.com/search?q=cats&tbm=isch",
  
  /* JavaScript evaluation result (stringified object - the returned type is up to you). */
  "result": {
    "cat": "data:image/jpeg;base64,/9j/4AAQSkZ...yiFQ2pa4tNPQitOFX//Z"
  },

  /* Optional BASE64-encoded PDF, when "takePdfSnapshot" is given. */
  "pdfSnapshot": "Aci2zo...S51==",

  "network": {
    "requests": [
      {
        "method": "GET",
        "resourceType": "document",
        "url": "https://www.google.com/search?q=cats&tbm=isch"
      },
      {
        "method": "GET",
        "resourceType": "image",
        "url": "https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg"
      },
    ]
  },
}
```

Response body when request fails:

```json
{
  /** Error message. Always defined in error responses. */
  "error": "page.evaluate: Evaluation failed: ReferenceError: windo is not defined\n    at eval (eval at <anonymous> (eval at evaluate (:303:29)), <anonymous>:3:41)\n    at eval (eval at evaluate (:303:29), <anonymous>:9:30)",

  /**
   * Error code. Always defined in error responses.
   * 
   * - BAD_REQUEST => Invalid request.
   * - TIMEOUT => Render request timeout (the desired result is not obtained within timeout).
   * - NAVIGATION => Navigation errors, such as malformed URL, DNS or TLS certificate errors.
   * - JS => A JavaScript error occurred (in the provided "js").
   * - UNKNOWN => Unpredicted errors which means that webrender has failed.
   */
  "errorCode": "JS", // See error codes below.

  /** Always the requested URL. */
  "url": "https://www.google.com/search?q=cats&tbm=isch",

  /** Always null */
  "result": null,
}
```
