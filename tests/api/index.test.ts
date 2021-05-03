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
});
