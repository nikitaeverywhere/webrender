import {
  BrowserContext,
  chromium,
  ChromiumBrowser,
  errors,
} from "playwright-chromium";
import { error, log } from "utils";

let globalBrowser: Promise<ChromiumBrowser>;

export const getGlobalBrowser = () => {
  if (globalBrowser) {
    return globalBrowser;
  }
  return (globalBrowser = new Promise(async (resolve) => {
    log(`Starting global browser...`);
    const browser = await chromium
      .launch({
        headless: true,
        ...(process.env.CHROME_BIN
          ? { executablePath: process.env.CHROME_BIN }
          : {}),
      })
      .catch((e) => {
        console.error(e);
        process.exit(1);
      });
    await browser.newPage(); // Open a first tab which should always be blank.

    log(`Global browser is ready.`);
    resolve(browser);
  }));
};

export const closeBrowser = async () => {
  if (globalBrowser && (await globalBrowser).isConnected()) {
    await (await globalBrowser).close();
    log(`Global browser is closed.`);
  }
};

const WINDOW_VARIABLE_NAME = `___webrender`;
export const getPageInitScriptFor = (
  js: string,
  jsOn: JsOn = "commit"
) => `try {
  const AsyncFunction = Object.getPrototypeOf(
    async function () {}
  ).constructor;
  const f = new AsyncFunction("webrender", \`${js
    .replace(/`/g, "\\`")
    .replace(/\${/g, "\\${")}\`);
  const promise = ${
    jsOn === "commit"
      ? "f()"
      : `new Promise((resolve) => {
    ${
      jsOn === "domcontentloaded"
        ? 'document.addEventListener("DOMContentLoaded"'
        : 'window.addEventListener("load"'
    }, () => resolve());
  }).then(() => f())`
  };
  Object.defineProperty(window, '${WINDOW_VARIABLE_NAME}', {
    get: () => promise
  });
} catch (e) {
  console.error("Page init script has failed!", e);
}`;

const closeContext = async (ctx: BrowserContext) => {
  try {
    await ctx.close();
  } catch (e) {
    error(`Can't close browser context!`, e);
  }
};

type JsOn = "commit" | "domcontentloaded" | "load";
type OpenUrlError = {
  error: string;
  errorCode:
    | "TIMEOUT" // Timed out - page navigation or rendering or JavaScript evaluation was not complete in time.
    | "NAVIGATION" // Navigation errors: DNS, SSL etc.
    | "JS" // JS evaluation error
    | "UNKNOWN"; // Unexpected errors
};
type OpenUrlResult = {
  /** URL at where either the page ended up or JS result was returned. */
  url: string;
  /** JS invocation result. */
  result: any;
  /** Base64 of the PDF snapshot. */
  pdfSnapshotBase64?: string;
};
const getErrorResult = async (
  page: BrowserContext,
  e: any,
  errorCode: OpenUrlError["errorCode"] = "UNKNOWN"
): Promise<OpenUrlError> => {
  await closeContext(page);
  let errorMessage = `${e.message}`;

  if (e instanceof errors.TimeoutError) {
    errorMessage = "The result was not obtained within the given timeout";
    errorCode = "TIMEOUT";
  }
  if (errorCode === "JS" && typeof e.stack === "string") {
    e.stack = e.stack.replace(
      // Cleanup error stack from fuss
      /\n\s+at\sopenUrl\s[\w\W]*/,
      ""
    );
  }

  error(`❕ Rendering error, code ${errorCode},`, e);

  return {
    error: errorMessage,
    errorCode,
  };
};

// If rename then fix the stack cleanup code above.
export const openUrl = async ({
  url,
  js = "",
  jsOn = "commit",
  timeout = 25000,
  takePdfSnapshot = false,
}: {
  url: string;
  js?: string;
  jsOn?: JsOn;
  timeout?: number;
  takePdfSnapshot?: boolean;
}): Promise<OpenUrlError | OpenUrlResult> => {
  const browser = await getGlobalBrowser();

  log(`Preparing new context for rendering...`);
  const ctxStart = Date.now();
  const context = await browser.newContext({
    bypassCSP: true, // Required for script invocations
  });
  const page = await context.newPage();
  log(`✔ Prepared new context for rendering in ${Date.now() - ctxStart}ms`);

  let pdfSnapshotBase64: string | undefined = undefined;

  if (js) {
    log(
      `Adding custom init JS to the page (URL=${url}): <script>${js}\n</script>`
    );
    page.on(
      "console",
      (msg) =>
        msg.type() === "error" &&
        log(`JS error |`, msg.text().replace(/\n[\w\W]*/, ""), `@ [${url}]`)
    );
    await page.addInitScript({
      content: getPageInitScriptFor(js, jsOn),
    });
  }

  log(`Opening page URL=${url}...`);
  const pageLoadStartedAt = Date.now();
  try {
    await page.goto(url, {
      waitUntil: "commit",
      timeout,
    });
    log(`✔ Page opened in ${Date.now() - pageLoadStartedAt}ms at URL=${url}`);
  } catch (e) {
    return await getErrorResult(context, e, "NAVIGATION");
  }

  const startedAt = Date.now();
  const timeElapsedAfterPageCommit = startedAt - pageLoadStartedAt;
  let nextTimeout = Math.max(1, timeout - timeElapsedAfterPageCommit);
  let result: any = null;
  if (js) {
    let jsContextPageUrl = page.url();
    while (true) {
      try {
        log(`Evaluating given JavaScript on the page ${page.url()}...`);
        result = await Promise.race([
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new errors.TimeoutError("JavaScript execution has timed out.")
                ),
              nextTimeout
            )
          ),
          page
            // Warning: even the code inside evaluate seems to be native to the current context (typescript),
            // IT IS INDEED TAKEN AS-IS AND IS EXECUTED IN THE BROWSER. ANY TYPE DECLARATIONS OR
            // TYPESCRIPT TRANSPILER ARTIFACTS WILL FAIL THIS CODE IN THE BROWSER.
            .evaluate(async (WINDOW_VARIABLE_NAME) => {
              /* @ts-expect-error */
              return await window[WINDOW_VARIABLE_NAME];
            }, WINDOW_VARIABLE_NAME),
        ]);
        break;
      } catch (e: any) {
        // TODO(https://github.com/microsoft/playwright/issues/27374): maybe a better way to handle the navigation error.
        const failedAtUrl = page.url();
        const isNavError = ((e.message || e.stack || e) + "").includes(
          "because of a navigation"
        );
        if (isNavError) {
          await new Promise((r) => setTimeout(r, 20)); // Prevents infinite loops in case of fire
          const timeElapsedAfterPageCommit = Date.now() - pageLoadStartedAt;
          nextTimeout = Math.max(1, timeout - timeElapsedAfterPageCommit);
          jsContextPageUrl = failedAtUrl;
          log(
            `[i] JavaScript error is handled as a page navigation, ${nextTimeout}ms left [${jsContextPageUrl} -> ${failedAtUrl}]`
          );
          continue;
        } else {
          log(`[i] JavaScript error at URL=${failedAtUrl}`);
        }
        return await getErrorResult(context, e, "JS");
      }
    }
    log(`✔ JS evaluated in ${Date.now() - startedAt}ms at URL=${page.url()}`);
  } else {
    log(`Waiting until page load event, URL=${page.url()}...`);
    try {
      await page.waitForLoadState("load", {
        timeout: nextTimeout,
      });
    } catch (e) {
      return await getErrorResult(context, e);
    }
    log(`✔ Page loaded in ${Date.now() - startedAt}ms at URL=${page.url()}`);
  }

  if (takePdfSnapshot) {
    try {
      log(`Taking PDF snapshot at URL=${page.url()}...`);
      const startedAt = Date.now();
      pdfSnapshotBase64 = (await page.pdf({ format: "A4" })).toString("base64");
      log(
        `✔ PDF snapshot is done in ${
          Date.now() - startedAt
        }ms at URL=${page.url()}...`
      );
    } catch (e) {
      error(`Unable to generate PDF snapshot for ${page.url()}`);
    }
  }

  const finalUrl = page.url();

  log(`Closing rendering context..`);
  await closeContext(context);

  log(
    `✔ Rendering complete in ${
      Date.now() - pageLoadStartedAt
    }ms for URL=${url} at final URL=${finalUrl}`
  );
  return {
    url: finalUrl,
    result,
    pdfSnapshotBase64,
  };
};
