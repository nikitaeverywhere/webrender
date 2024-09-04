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
    expect(response.network.requests).to.deep.contain({
      method: "GET",
      resourceType: "document",
      url: "https://www.google.com/search?q=cats&tbm=isch",
    });
  });

  it("renders an empty page when given empty URL", async () => {
    const result = await fetch(URL_RENDER, {
      method,
      headers,
      body: JSON.stringify({
        url: "",
        jsOn: "domcontentloaded",
        js: `
          return document.body.innerHTML;
        `,
      }),
    });
    const response = await result.json();

    expect(result.status).to.equal(200);
    expect(response.result).to.equal("");
  });

  it("properly times out in case JavaScript execution is stuck", async () => {
    const result = await fetch(URL_RENDER, {
      method,
      headers,
      body: JSON.stringify({
        url: "https://www.google.com/search?q=cats&tbm=isch",
        js: `
          await new Promise(r => setTimeout(r, 999999));
          return 'never returned';
        `,
        timeout: 4000,
      }),
    });
    const response = await result.json();

    expect(result.status).to.equal(500);
    expect(response.result).to.be.null;
    expect(response.error).to.be.a("string");
    expect(response.errorCode).to.be.equal("TIMEOUT");
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
    expect(response.errorCode).to.equal("JS");
    expect(response.error).to.include("page.evaluate:");
    expect(response.error).to.include(
      "ReferenceError: thisIsSomethingWeird is not defined"
    );
    expect(response.error).not.to.include("/build/");
  });

  it("returns JavaScript syntax error when provided 'js' is not valid", async () => {
    const result = await fetch(URL_RENDER, {
      method,
      headers,
      body: JSON.stringify({
        url: "https://www.google.com/",
        js: "(",
      }),
    });
    const response = await result.json();

    expect(result.status).to.equal(500, JSON.stringify(response));
    expect(response).to.have.property("error");
    expect(response.errorCode).to.equal("JS");
    expect(response.error).to.include("page.evaluate:");
    expect(response.error).to.include("Syntax");
    expect(response.error).not.to.include("/build/");
  });

  it("snapshots pdf", async () => {
    const result = await fetch(URL_RENDER, {
      method,
      headers,
      body: JSON.stringify({
        url: "",
        jsOn: "domcontentloaded",
        js: `
          return document.body.innerHTML = 'test';
        `,
        takePdfSnapshot: true,
      }),
    });
    const response = await result.json();

    expect(result.status).to.equal(200, JSON.stringify(response));
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

  it("handles HTTP redirects", async () => {
    const result = await fetch(URL_RENDER, {
      method,
      headers,
      body: JSON.stringify({
        url: "http://google.com",
        jsOn: "domcontentloaded",
        js: `
          return document.title;
        `,
      }),
    });
    const response = await result.json();

    expect(result.status).to.equal(200);
    expect(response.url).to.include("https://www.");
    expect(response.result).to.include("Google");
  });

  it("handles javascript redirects", async () => {
    const result = await fetch(URL_RENDER, {
      method,
      headers,
      body: JSON.stringify({
        url: "https://www.google.com", // A page without redirect
        jsOn: "domcontentloaded",
        js: `
          if (!window.location.href.startsWith("https://www.google.com.ua")) {
            window.location.href = "https://www.google.com.ua";
            await new Promise(r => setTimeout(r, 2000));
            return 'no, it should not return this';
          }
          return 'yes, it should return this';
        `,
      }),
    });
    const response = await result.json();

    expect(result.status).to.equal(200);
    expect(response.url).to.include("https://www.google.com.ua");
    expect(response.result).to.be.equal("yes, it should return this");
  });
});
