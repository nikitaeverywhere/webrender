import { start, stop } from "../build";

before(async () => {
  await start();
});

after(async () => {
  await stop();
});
