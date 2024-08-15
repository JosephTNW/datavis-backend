import app from "./app.ts";

console.log("Hello via Bun!");

Bun.serve({
    fetch: app.fetch,
    port: process.env.PORT ?? 3030,
})