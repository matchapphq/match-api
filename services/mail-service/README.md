# Match Mail Service

A standalone microservice responsible for handling email delivery for the Match platform. Built with [Bun](https://bun.sh) and [BullMQ](https://docs.bullmq.io/), this service consumes jobs from a Redis queue to process email tasks asynchronously.

## 🚀 Features

- **Asynchronous Processing**: Decouples email sending from the main API to improve response times and reliability.
- **Queue Consumer**: Listens to the `mail-queue` for incoming email jobs.
- **Concurrency Control**: Configured to process multiple jobs in parallel (default: 3).
- **Robust Error Handling**: Logs completed and failed jobs for monitoring.

## 📋 Prerequisites

- **Runtime**: [Bun](https://bun.sh/) v1.0+
- **Infrastructure**: Redis server (required for BullMQ)

## 🛠️ Installation

Navigate to the service directory and install dependencies:

```bash
cd services/mail-service
bun install
```

## ⚙️ Configuration

The service uses environment variables for configuration. You can set these in a `.env` file or in your environment.

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Full Redis connection string | `redis://localhost:6379` |
| `REDIS_HOST` | Redis hostname (if URL not provided) | `localhost` |
| `REDIS_PORT` | Redis port (if URL not provided) | `6379` |

## ▶️ Running the Service

### Development
To run the service in development mode (watching for file changes is not default in `bun run index.ts` but typical for dev):

```bash
bun run index.ts
```

### Production
For production environments:

```bash
bun run index.ts
```

## 📂 Project Structure

- **`index.ts`**: Entry point. Initializes the worker and sets up global event listeners for job completion and failure.
- **`worker/`**: Contains the BullMQ worker definitions.
  - `mail.worker.ts`: The specific worker logic for the `mail-queue`.
- **`config/`**: Configuration files.
  - `redis.ts`: Redis connection settings used by the queues.

## 🔌 Integration

To send an email from another service (e.g., the main API), add a job to the `mail-queue` using BullMQ:

```typescript
import { Queue } from "bullmq";

const mailQueue = new Queue("mail-queue", { connection: redisConfig });

await mailQueue.add("send-welcome", {
  to: "user@example.com",
  subject: "Welcome to Match!",
  template: "welcome-email",
  data: { name: "John Doe" }
});
```