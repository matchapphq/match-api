import type { Context } from "hono";
import { SupportLogic } from "./support.logic";
import { z } from "zod";

const bugReportSchema = z.object({
  user_name: z.string().min(1),
  user_email: z.string().email(),
  description: z.string().min(1),
  metadata: z.any().optional(),
});

export class SupportController {
  constructor(private readonly logic: SupportLogic) {}

  async reportBug(c: Context) {
    try {
      const body = await c.req.json();
      const validatedData = bugReportSchema.safeParse(body);

      if (!validatedData.success) {
        return c.json({ 
          error: "INVALID_INPUT", 
          details: validatedData.error.errors 
        }, 400);
      }

      const { user_name, user_email, description, metadata } = validatedData.data;

      const result = await this.logic.reportBug({
        userName: user_name,
        userEmail: user_email,
        description,
        metadata,
      });

      return c.json(result);
    } catch (error) {
      console.error("Bug report submission error:", error);
      return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  }
}
