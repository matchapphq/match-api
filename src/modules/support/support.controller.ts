import type { Context } from "hono";
import { SupportLogic } from "./support.logic";
import { z } from "zod";
import UserRepository from "../../repository/user.repository";

const bugReportSchema = z.object({
  user_name: z.string().min(1),
  user_email: z.string().email(),
  description: z.string().min(1),
  metadata: z.any().optional(),
});

const dataExportRequestSchema = z.object({
  message: z
    .string()
    .max(2000)
    .refine((value) => value.trim().length > 0, {
      message: "Message is required",
    }),
});

export class SupportController {
  private readonly userRepository = new UserRepository();

  constructor(private readonly logic: SupportLogic) {}

  async reportBug(c: Context) {
    try {
      const body = await c.req.json();
      const validatedData = bugReportSchema.safeParse(body);

      if (!validatedData.success) {
        return c.json({ 
          error: "INVALID_INPUT", 
          details: validatedData.error.issues,
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

  async requestDataExport(c: Context) {
    try {
      const body = await c.req.json();
      const validatedData = dataExportRequestSchema.safeParse(body);

      if (!validatedData.success) {
        return c.json(
          {
            error: "INVALID_INPUT",
            details: validatedData.error.issues,
          },
          400,
        );
      }

      const user = c.get("user") as {
        id?: string;
        email?: string;
        firstName?: string | null;
      } | undefined;
      if (!user?.id || !user?.email) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const profile = await this.userRepository.getUserById(user.id);
      const profileName = [profile?.first_name, profile?.last_name]
        .map((part) => (typeof part === "string" ? part.trim() : ""))
        .filter(Boolean)
        .join(" ");

      const userName =
        profileName ||
        (typeof user.firstName === "string" ? user.firstName.trim() : "") ||
        "Utilisateur";

      const result = await this.logic.requestDataExport({
        userId: user.id,
        userEmail: user.email,
        userName,
        message: validatedData.data.message,
      });

      return c.json(result, 201);
    } catch (error) {
      console.error("Data export request submission error:", error);
      return c.json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  }
}
