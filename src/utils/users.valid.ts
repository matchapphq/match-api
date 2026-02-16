import { password } from "bun";
import z from "zod";

export const DeleteRequestSchema = z.object({
    reason: z.string().min(1, { message: "Reason for deletion is required" }),
    details: z.string().optional(),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
})

export type DeleteRequestSchemaType = z.infer<typeof DeleteRequestSchema>;