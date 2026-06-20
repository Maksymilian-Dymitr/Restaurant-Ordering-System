# Restaurant Ordering System

An event-driven microservice backend for a fast-food restaurant, built with Bun, Elysia, RabbitMQ, PostgreSQL, and Redis.

## Start

```bash
cp .exemple.env .env   # then edit .env to set your secrets
docker compose up --build
```

Starts all services, initialises the database schema with seed data, and exposes the system on **https://localhost** (HTTP on port 80 redirects to HTTPS).

## Architecture

All traffic enters through **nginx** on ports 80/443. Internal services have no ports exposed outside the Docker network — nginx is the only way in.

```
Client
  │
  ▼
nginx :80/:443  (reverse proxy + SSL termination)
  ├── /menu          → product-service
  ├── /orders        → order-service
  ├── /kitchen       → kitchen-service
  ├── /notification  → notification-service
  └── /errors        → error-service
```

## API Endpoints

### Menu
| Method | Path | Description |
|---|---|---|
| `GET` | `/menu` | List all menu items |

### Orders
| Method | Path | Description |
|---|---|---|
| `POST` | `/orders` | Place a new order |
| `GET` | `/orders` | List all orders |
| `GET` | `/orders/:id` | Get order by ID |

**POST /orders body:**
```json
{
  "customerId": "customer-1",
  "products": [
    { "productId": 1, "quantity": 2 }
  ]
}
```
All fields are validated — missing or wrong types return **422**.

### Kitchen

All kitchen endpoints require the `x-kitchen-key` header. Requests without a valid key return **403 Forbidden**.

Set `KITCHEN_API_KEY` in your `.env` file before starting.

| Method | Path | Description |
|---|---|---|
| `GET` | `/kitchen/orders` | List all orders received by the kitchen |
| `GET` | `/kitchen/orders/stream` | SSE stream — pushes the full order queue every 5 seconds |
| `PATCH` | `/kitchen/orders/:id` | Update order status (`pending` / `ongoing` / `done`) |
| `POST` | `/kitchen/orders/:id/done` | Mark order as done and notify the rest of the system |

**PATCH /kitchen/orders/:id body:**
```json
{ "status": "ongoing" }
```

### Notifications
| Method | Path | Description |
|---|---|---|
| `GET` | `/notification/:customerId` | Get all notifications for a customer |
| `DELETE` | `/notification/:customerId` | Delete all notifications for a customer |

### Errors
| Method | Path | Description |
|---|---|---|
| `GET` | `/errors` | List all logged events (`?service=order-service` to filter) |
| `GET` | `/errors/:id` | Get a specific log entry |

## Order flow

1. Customer sends `POST /orders` — order is saved with status `pending`, `order.created` is published to RabbitMQ.
2. Kitchen-service receives `order.created` via RabbitMQ and adds the order to its queue.
3. Kitchen staff checks `GET /kitchen/orders`, marks it `ongoing` via `PATCH`, then sends `POST /kitchen/orders/:id/done` when finished.
4. `order.ready` is published to RabbitMQ — order-service sets status to `ready`, notification-service creates a customer notification.
5. error-service logs every `order.created` event for auditing.

## Swagger

Each service exposes a Swagger UI at `/<service>/swagger`, protected by basic auth (username `admin`, password set via `SWAGGER_PASSWORD` in `.env`).

| Service | URL |
|---|---|
| Menu | `https://localhost/menu/swagger` |
| Orders | `https://localhost/orders/swagger` |
| Kitchen | `https://localhost/kitchen/swagger` |
| Notifications | `https://localhost/notification/swagger` |
| Errors | `https://localhost/errors/swagger` |

## Running tests

Unit tests (no Docker needed):

```bash
for dir in backend/*/; do (cd "$dir" && bun test); done
```

E2E tests (requires `docker compose up`):

```bash
cd e2e && bun test
```

## Example requests

```bash
# List menu
curl -k https://localhost/menu

# Place an order
curl -k -X POST https://localhost/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId": "alice", "products": [{"productId": 1, "quantity": 1}]}'

# Kitchen: see incoming orders (API key required)
curl -k -H "x-kitchen-key: dev-kitchen-key-change-in-production" https://localhost/kitchen/orders

# Kitchen: stream live order queue via SSE
curl -k --no-buffer -H "x-kitchen-key: dev-kitchen-key-change-in-production" https://localhost/kitchen/orders/stream

# Kitchen: mark order as done (replace 1 with the actual orderId)
curl -k -H "x-kitchen-key: dev-kitchen-key-change-in-production" -X POST https://localhost/kitchen/orders/1/done

# Check order status
curl -k https://localhost/orders/1

# Check customer notification
curl -k https://localhost/notification/alice

# Delete customer notifications
curl -k -X DELETE https://localhost/notification/alice
```

> `-k` skips SSL verification for the self-signed certificate used in development.

## Infrastructure

| Component | Technology |
|---|---|
| Runtime | Bun |
| Framework | Elysia (TypeScript) |
| Database | PostgreSQL 17 |
| Cache | Redis 7 (60 s TTL) |
| Message broker | RabbitMQ 4 |
| Reverse proxy | nginx (SSL termination) |
