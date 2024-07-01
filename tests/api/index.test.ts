import { expect } from "chai";
import fetch from "node-fetch";
import { LOCAL_API_URL } from "../const";

describe("/", () => {
  it("prints version", async () => {
    const result = await fetch(`${LOCAL_API_URL}/`);
    const response = await result.json();

    expect(result.status).to.equal(200);
    expect(response).to.have.property("version");
  });

  it("passes extra headers to requests", async () => {
    const URL_RENDER = `${LOCAL_API_URL}/render`;
    const method = "POST";
    const headers = {
      "Content-Type": "application/json",
    };
    const result = await fetch(URL_RENDER, {
      method,
      headers,
      body: JSON.stringify({
        url: LOCAL_API_URL,
        extraHttpHeaders: {
          "test-header": "test-value",
        },
        js: `
          let res;
          while (true) {
            try {
              res = JSON.parse(document.body.textContent);
              break;
            } catch (e) {
             console.error(e);
            }
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          return res;
        `,
      }),
    });
    const response = await result.json();

    expect(result.status).to.equal(200);
    expect(response.result).to.have.property("version");
    expect(response.result.headers).to.have.property("test-header");
    expect(response.result.headers["test-header"]).to.be.equal("test-value");
  });
});
