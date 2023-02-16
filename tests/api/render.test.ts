import { expect } from "chai";
import fetch from "node-fetch";
import { LOCAL_API_URL } from "../const";

const URL_RENDER = `${LOCAL_API_URL}/render`;
const URL_ROOT = `${LOCAL_API_URL}/`;
const method = "POST";
const headers = {
  "Content-Type": "application/json",
};

describe("/render", () => {
  it("successfully gets cats from Google Image Search", async () => {
    const result = await fetch(URL_RENDER, {
      method,
      headers,
      body: JSON.stringify({
        url: "https://www.google.com/search?q=cats&tbm=isch",
        js: `
          let firstCat;
          while (true) {
            if (firstCat = document.querySelector('div[jsaction] div[jsaction] img')) {
              return { cat: firstCat.src };
            }
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        `,
      }),
    });
    const response = await result.json();

    expect(result.status).to.equal(200);
    expect(response.result).to.have.property("cat");
    expect(response.result.cat).length.to.be.greaterThan(30); // Just test that it's there
  });

  it("renders an empty page when given empty URL", async () => {
    const result = await fetch(URL_RENDER, {
      method,
      headers,
      body: JSON.stringify({
        url: "",
        js: `
          return document.body.innerHTML;
        `,
      }),
    });
    const response = await result.json();

    expect(result.status).to.equal(200);
    expect(response.result).to.equal("");
  });

  it("properly times out in case JavaScript execution stuck", async () => {
    const result = await fetch(URL_RENDER, {
      method,
      headers,
      body: JSON.stringify({
        url: "https://www.google.com/search?q=cats&tbm=isch",
        js: `
          await new Promise(r => setTimeout(r, 999999));
          return 'never returned';
        `,
      }),
    });
    const response = await result.json();

    expect(result.status).to.equal(200);
    expect(response.result).to.be.null;
    expect(response.error).to.be.undefined;
  });

  it("returns the exact JavaScript error when provided 'js' is not valid", async () => {
    const result = await fetch(URL_RENDER, {
      method,
      headers,
      body: JSON.stringify({
        url: "https://www.google.com/",
        js: "thisIsSomethingWeird",
      }),
    });
    const response = await result.json();

    expect(result.status).to.equal(500, JSON.stringify(response));
    expect(response).to.have.property("error");
    expect(response.error).to.include("page.evaluate:");
    expect(response.error).to.include(
      "ReferenceError: thisIsSomethingWeird is not defined"
    );
  });

  it("snapshots pdf", async () => {
    const result = await fetch(URL_RENDER, {
      method,
      headers,
      body: JSON.stringify({
        url: "",
        js: `
          return document.body.innerHTML = 'test';
        `,
        takePdfSnapshot: true,
      }),
    });
    const response = await result.json();

    expect(result.status).to.equal(200);
    expect(response.result).to.equal("test");
    expect(response.pdfSnapshot).to.have.length.greaterThan(0);
    expect(Buffer.from(response.pdfSnapshot, "base64").toString()).to.contain(
      "/CreationDate"
    );
  });

  it("waits for weird timely requests to finish before closing", async () => {
    const result = await fetch(URL_RENDER, {
      method,
      headers,
      body: JSON.stringify({
        url: "",
        js: `
          const f = async () => {
            const res = await fetch('${URL_ROOT}');
            const json = await res.json()
            if (!json.version) {
              throw new Error('Fetch problem')
            }
            await new Promise(r => setTimeout(r, 600))
            return json.version
          }

          await f(); // 600ms
          await f(); // 1200ms
          await f(); // 1800ms
          await f(); // 1400ms
          const res = await f(); // 2200ms

          return res
        `,
        timeout: 4000,
      }),
    });
    const response = await result.json();

    expect(result.status).to.equal(200);
    expect(response.result).to.equal("1.0.0");
  });

  it("closes page without any activity in 1000ms by default", async () => {
    const startedAt = Date.now();
    const result = await fetch(URL_RENDER, {
      method,
      headers,
      body: JSON.stringify({
        url: "",
        js: `
          await new Promise(r => setTimeout(r, 100500))
          return 1
        `,
      }),
    });
    const response = await result.json();
    const elapsed = Date.now() - startedAt;

    expect(result.status).to.equal(200);
    expect(response.result).to.equal(null);
    expect(response.error).to.be.undefined;
    expect(elapsed).to.be.lessThan(2000);
    expect(elapsed).to.be.greaterThan(1000);
  });

  it("waitAfterResourcesLoad = 3000ms", async () => {
    const startedAt = Date.now();
    const result = await fetch(URL_RENDER, {
      method,
      headers,
      body: JSON.stringify({
        url: "",
        js: `
          await new Promise(r => setTimeout(r, 100500))
          return 1
        `,
        waitAfterResourcesLoad: 3000,
      }),
    });
    const response = await result.json();
    const elapsed = Date.now() - startedAt;

    expect(result.status).to.equal(200);
    expect(response.result).to.equal(null);
    expect(response.error).to.be.undefined;
    expect(elapsed).to.be.lessThan(4000);
    expect(elapsed).to.be.greaterThan(3000);
  });
});
