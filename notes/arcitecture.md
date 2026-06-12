                        ┌─────────────────────────────────────────┐
                        │               NGINX (Port 80/443)         │
                        │         Reverse Proxy + SSL Termination   │
                        └──┬──────────┬──────────┬──────────┬──────┘
                           │          │          │          │
                     /menu │  /orders │ /notifi- │  /errors │
                           ▼          ▼  cation  ▼          ▼
                    ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
                    │ product  │ │  order  │ │notif.    │ │  error   │
                    │ service  │ │ service │ │service   │ │ service  │
                    │  :3001   │ │  :3002  │ │  :3003   │ │  :3004   │
                    └────┬─────┘ └────┬────┘ └────┬─────┘ └────┬─────┘
                         │            │            │             │
                    ┌────▼────────────▼────────────▼─────────────▼────┐
                    │                  RabbitMQ                        │
                    │  order.created ──► kitchen-service               │
                    │  order.ready   ──► order + notification          │
                    │  service.error ──► error-service                 │
                    └──────────────────────────────────────────────────┘
                                          │
                    ┌─────────────────────▼────────────────────────────┐
                    │            PostgreSQL + Redis                     │
                    └──────────────────────────────────────────────────┘