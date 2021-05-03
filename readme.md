# WebRender • a simple container for rendering the Web

This is a [docker container](https://hub.docker.com/r/zitros/webrender) for quick website rendering.

```
docker pull zitros/webrender
```

Primarily, it exposes an API to get the required answer from the webpage (as if viewed from the browser)
as soon as it is available. It uses [Playwright](https://github.com/microsoft/playwright) with Chromium
under the hood.

## API

This container exposes its API on port 80. Example: `http://this-container/health-check`.

+ Request body type (for POST requests): `application/json`
+ Response body type (for all endpoints): `application/json`

### `GET /health-check`

Endpoint for checking whether this container is healthy. It will render a dummy page served on localhost
under the hood and return status `200` when all right.

### `POST /render`

Renders the page as if it was opened in Chrome browser, executing JavaScript, loading styles, etc.
When rendering, it invokes arbitrary JavaScript code provided in `"js"` in **async browser context**,
and returns the `JSON.stringify()` of whatever this code returns in the `"result"` property of the
response body.

Request body:

```js
{
  // REQUIRED. URL of the page to render.
  "url": "https://www.google.com/search?q=cats&tbm=isch",

  // OPTIONAL. Timeout for rendering the page. Defaults to 20 seconds, then the result will be {null}.
  "timeout": 20000,

  // OPTIONAL. WebRender will wait for 1 second by default after all network
  // requests are done, and then returns {null} as a result regardless
  // of whether the provided "js" is still running.
  "waitAfterResourcesLoad": 1000, 

  // OPTIONAL. An arbitrary JavaScript code to be invoked in ASYNC CONTEXT in the browser, immediately
  // when page starts loading. Once this code returns, WebRender will immediately close the page and
  // return the result which is equal to a serializable value of what was returned.
  "js": `
    // This code is specified as a template string for readability. It should use standard JSON.
    let firstCat;
    while (true) {
      if (firstCat = document.querySelector('div[jsaction] div[jsaction] img')) {
        return { cat: firstCat.src }; // As soon as this code returns, /grab will respond with the result.
      }
      await new Promise(resolve => setTimeout(resolve, 50)); // Sleep for 50ms
    }
  `,
}
```

Response body example when request succeeds:

```js
{
  "error": "Validation errors, or an error stack if any error happened when invoking provided JavaScript code.",
  "url": "https://www.google.com/search?q=cats&tbm=isch",
  "result": {
    "cat": "data:image/jpeg;base64,/9j/4AAQSkZ...yiFQ2pa4tNPQitOFX//Z"
  }
}
```

Response body when provided `"js"` is invalid or throws an error:

```js
{
    "url": "https://www.google.com/search?q=cats&tbm=isch",
    "error": "page.evaluate: Evaluation failed: ReferenceError: windo is not defined\n    at eval (eval at <anonymous> (eval at evaluate (:303:29)), <anonymous>:3:41)\n    at eval (eval at evaluate (:303:29), <anonymous>:9:30)",
    "result": null
}
```