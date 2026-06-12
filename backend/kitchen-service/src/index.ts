import { connectRabbitMQ, consume } from "./rabbitmq";
import { handleOrderCreated } from "./handler";

await connectRabbitMQ();

await consume("order.created", "order.created.kitchen-service", handleOrderCreated);
