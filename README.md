# Restaurant Ordering System

A distributed, event-driven backend for a fast-food ordering system (inspired by Max / McDonald's), built with Bun, Elysia, RabbitMQ, PostgreSQL, and Redis.

## Start the system

```bash
docker compose up
```

This starts all services, runs the database DDL and seed data, and exposes the system on **http://localhost**.

## Public entry point

All traffic enters through **nginx on port 80** (`http://localhost`). The internal services are not directly reachable from outside.

| Endpoint | Service | Description |
|---|---|---|
| `GET /menu` | product-service | List all menu items |
| `POST /orders` | order-service | Place a new order |
| `GET /orders/:id` | order-service | Get order by ID |
| `GET /orders` | order-service | List all orders |
| `GET /notification/:customerId` | notification-service | Get notifications for a customer |
| `GET /errors` | error-service | List logged service errors |
| `GET /errors/:id` | error-service | Get a specific error log |

Each service also exposes a Swagger UI at `/swagger` on its internal port (3001–3004).

## Order flow

1. Client posts to `POST /orders` → order-service creates the order and emits `order.created`
2. kitchen-service receives `order.created`, processes it (3 s), emits `order.ready`
3. order-service receives `order.ready` → marks the order as `ready`
4. notification-service receives `order.ready` → stores a notification for the customer

## Example request

```bash
curl -X POST http://localhost/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId": "customer-1", "products": [{"productId": 1, "quantity": 2}]}'
```

## Infrastructure

| Service | Technology |
|---|---|
| Database | PostgreSQL 17 |
| Cache | Redis 7 (60 s TTL) |
| Message broker | RabbitMQ 4 |
| Reverse proxy | nginx |
