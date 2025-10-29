import app from "./src/server";

Bun.serve({
    port:8008,
    fetch: app.fetch,
})
