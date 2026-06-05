import { Elysia } from "elysia";

const app = new Elysia()
  .get("/menu", () => {})
  .get("/kitchen/orders", () => {})
  .get("/notification/:customerId", () => {})
  .get("/orders/:id", () => {})
  .post("/orders", () => {})
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
