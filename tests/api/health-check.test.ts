import { expect } from "chai";
import { LOCAL_API_URL } from "../const";
import fetch from "node-fetch";

describe("/health-check", () => {
  it("is successful", async () => {
    const result = await fetch(`${LOCAL_API_URL}/health-check`);
    const response = await result.json();

    expect(result.status).to.equal(200);
    expect(response).to.have.property("result");
  });
});
