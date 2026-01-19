import { createFactory } from "hono/factory";
import { notificationQueue } from "../../queue/notification.queue";

class HealthController {
    private readonly factory = createFactory();
    
    public readonly health = this.factory.createHandlers(async (ctx) => {
        return ctx.text("OK");
    });
    
    public readonly test = this.factory.createHandlers(async (ctx) => {
        await notificationQueue.add('venue_owner_notify', {
          type: 'push',
          recipientId: "ownerId",
          venueId: "venueId",
          data: {
            tokens: "fenaefaaef",
            title: 'New booking request!',
            body: `Someone wants to book your venue test`
          }
        }, { 
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 50,
        });
        return ctx.text("Test");
    });
}

export default HealthController;
