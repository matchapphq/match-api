import { password } from "bun";
import z from "zod";

export const DeleteRequestSchema = z.object({
    reason: z.string().min(1, { message: "Reason for deletion is required" }),
    details: z.string().optional(),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
})

export const UpdatePasswordSchema = z.object({
    current_password: z.string().min(1, { message: "Current password is required" }),
    new_password: z.string().min(6, { message: "New password must be at least 6 characters" }),
    confirm_password: z.string().min(6, { message: "Password confirmation must be at least 6 characters" }),
}).refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
});

export type DeleteRequestSchemaType = z.infer<typeof DeleteRequestSchema>;
export type UpdatePasswordSchemaType = z.infer<typeof UpdatePasswordSchema>;