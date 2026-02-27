import z from "zod";

export const DeleteRequestSchema = z.object({
    reason: z.string().min(1, { message: "Reason for deletion is required" }),
    details: z.string().optional(),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
})

export const UpdatePasswordSchema = z.object({
    current_password: z.string().min(1, { message: "Current password is required" }).optional(),
    new_password: z.string().min(6, { message: "New password must be at least 6 characters" }),
    confirm_password: z.string().min(6, { message: "Password confirmation must be at least 6 characters" }),
}).refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
});

export const UpdateNotificationPreferencesSchema = z.object({
    email_reservations: z.boolean().optional(),
    email_marketing: z.boolean().optional(),
    email_updates: z.boolean().optional(),
    push_reservations: z.boolean().optional(),
    push_marketing: z.boolean().optional(),
    push_updates: z.boolean().optional(),
    sms_reservations: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: "At least one notification preference must be provided",
});

export const UpdatePrivacyPreferencesSchema = z.object({
    analytics_consent: z.boolean().optional(),
    marketing_consent: z.boolean().optional(),
    legal_updates_email: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: "At least one privacy preference must be provided",
});

export type DeleteRequestSchemaType = z.infer<typeof DeleteRequestSchema>;
export type UpdatePasswordSchemaType = z.infer<typeof UpdatePasswordSchema>;
export type UpdateNotificationPreferencesSchemaType = z.infer<typeof UpdateNotificationPreferencesSchema>;
export type UpdatePrivacyPreferencesSchemaType = z.infer<typeof UpdatePrivacyPreferencesSchema>;
