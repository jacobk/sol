import { app } from "./app.js";

const PORT = 8081;
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sol server listening on http://0.0.0.0:${PORT}`);
});

export { server };
