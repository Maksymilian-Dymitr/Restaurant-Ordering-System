import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { getMenu, verifyConnection } from "./repository";

await verifyConnection();

new Elysia()
  .use(swagger({ documentation: { info: { title: "Product Service", version: "1.0.0" } } }))
  .get("/menu", () => getMenu())
  .listen(3001, () => console.log("🦊 Elysia is running on port 3001"));
