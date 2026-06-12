import amqp from "amqplib"

let channel: amqp.Channel

export async function connectRabbitMQ() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL!)
  channel = await connection.createChannel()
  console.log("✅ Connected to RabbitMQ")
}

export async function publish(exchange: string, message: object) {
  await channel.assertExchange(exchange, "fanout", { durable: true })
  channel.publish(exchange, "", Buffer.from(JSON.stringify(message)))
}

export async function consume(
  exchange: string,
  queueName: string,
  handler: (message: object) => Promise<void> | void,
) {
  await channel.assertExchange(exchange, "fanout", { durable: true })
  await channel.assertQueue(queueName, { durable: true })
  await channel.bindQueue(queueName, exchange, "")
  channel.consume(queueName, async (msg) => {
    if (msg) {
      try {
        await handler(JSON.parse(msg.content.toString()))
        channel.ack(msg)
      } catch (error) {
        console.error("❌ Message handler failed:", error)
        channel.nack(msg, false, true)
      }
    }
  })
}
