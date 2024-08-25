import app from "./app.ts";

console.log("App Running on localhost:3030");

Bun.serve({
    fetch: app.fetch,
    port: process.env.PORT ?? 3030,
})