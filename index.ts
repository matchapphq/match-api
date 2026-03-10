import app from "./src/server";
import isEnvsDefined from "./src/utils/checkEnv";
import { setupScheduler } from "./src/config/scheduler";

// Import workers to start them
import "./src/workers/notification.worker";
import "./src/workers/stripe.worker";
import "./src/workers/billing-aggregation.worker";

if (!isEnvsDefined()) {
    console.error("[ERROR]: Environment variables are not defined.");
    process.exit(84);
}

// Initialize recurring jobs
setupScheduler().catch(err => {
    console.error("[Scheduler] Failed to initialize:", err);
});

Bun.serve({
    port: parseInt(Bun.env.PORT || "8008"),
    fetch: app.fetch,
})
