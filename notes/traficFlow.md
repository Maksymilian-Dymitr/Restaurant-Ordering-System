Klient: GET /menu
  → Nginx → product-service
  → Kollar Redis: HIT (data finns)
  → Returnerar direkt från cache, ingen DB-träff

Klient
  │
  │  POST /orders {"customerId": "c1", "products": [{"productId": 1, "qty": 2}]}
  ▼
Nginx (:443)
  │  SSL-terminering, routar /orders → order-service:3002
  ▼
order-service
  │  1. Validerar request-body
  │  2. INSERT INTO orders (status="pending")
  │  3. INSERT INTO order_items
  │  4. Publicerar till RabbitMQ exchange: "order.created"
  │     { customerId: "c1", orderId: 7, products: [...] }
  │  5. Returnerar 201 till klienten: { id: 7, status: "pending" }
  ▼
RabbitMQ – fanout "order.created"
  ├─▶ kitchen-service (queue: order.created.kitchen-service)
  └─▶ error-service   (queue: order.created.error-service) ← loggar eventet
  
kitchen-service
  │  1. Tar emot meddelandet
  │  2. Väntar 3 sekunder (simulerar matlagning)
  │  3. Publicerar till "order.ready" { orderId: 7, customerId: "c1" }
  ▼
RabbitMQ – fanout "order.ready"
  ├─▶ order-service        (queue: order.ready.order-service)
  └─▶ notification-service (queue: order.ready.notification-service)

order-service
  │  UPDATE orders SET status="ready" WHERE id=7
  │  Invaliderar Redis-cache för order 7
  
notification-service
  │  INSERT INTO notifications { customerId: "c1", message: "Your order is ready!" }
  │  Invaliderar Redis-cache för customer "c1"

Klient (polling)
  │
  │  GET /notification/c1
  ▼
Nginx → notification-service
  │  1. Kollar Redis: MISS
  │  2. SELECT FROM notifications WHERE customer_id="c1"
  │  3. Skriver till Redis (TTL 60s)
  │  4. Returnerar [{ message: "Your order is ready!" }]