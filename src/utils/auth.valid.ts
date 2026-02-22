import { z } from "zod";

export const RegisterRequestSchema = z.object({
    email: z.string().email().min(1, { message: "Email is required" }),
    username: z.string().min(1, { message: "Username is required" }).optional(),
    firstName: z.string().min(1, { message: "First name is required" }),
    lastName: z.string().min(1, { message: "Last name is required" }),
    bio: z.string().optional(),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
    role: z.enum(['user', 'venue_owner', 'admin']).optional(),
    referralCode: z.string()
        .trim()
        .regex(/^MATCH-RESTO-[A-Z0-9]{6}$/, { message: "Invalid referral code format" })
        .optional(),
    phone: z.string().optional(),
    fav_sports: z.array(z.string()).optional(),
    fav_team_ids: z.array(z.string()).optional(),
    home_lat: z.number().nullable().optional(),
    home_lng: z.number().nullable().optional(),
    ambiances: z.array(z.string()).optional(),
    budget: z.string().optional(),
    venue_types: z.array(z.string()).optional(),
})

export const LoginRequestSchema = z.object({
    email: z.string().email().min(1, { message: "Email is required" }),
    password: z.string().min(1, { message: "Password is required" }),
})

export const GoogleLoginRequestSchema = z.object({
    id_token: z.string().min(1, { message: "Google id_token is required" }),
})

export const AppleLoginRequestSchema = z.object({
    id_token: z.string().min(1, { message: "Apple id_token is required" }),
    first_name: z.string().trim().min(1).optional(),
    last_name: z.string().trim().min(1).optional(),
})

export const ForgotPasswordRequestSchema = z.object({
    email: z.string().email().min(1, { message: "Email is required" }),
})

export const VerifyResetCodeSchema = z.object({
    email: z.string().email().min(1, { message: "Email is required" }),
    code: z.string().length(6, { message: "Code must be 6 digits" }),
})

export const ResetPasswordSchema = z.object({
    email: z.string().email().min(1, { message: "Email is required" }),
    code: z.string().length(6, { message: "Code must be 6 digits" }),
    new_password: z.string().min(6, { message: "Password must be at least 6 characters" }),
})

export type RegisterRequestSchemaType = z.infer<typeof RegisterRequestSchema>;
export type LoginRequestSchemaType = z.infer<typeof LoginRequestSchema>;
export type GoogleLoginRequestSchemaType = z.infer<typeof GoogleLoginRequestSchema>;
export type AppleLoginRequestSchemaType = z.infer<typeof AppleLoginRequestSchema>;
export type ForgotPasswordRequestSchemaType = z.infer<typeof ForgotPasswordRequestSchema>;
export type VerifyResetCodeSchemaType = z.infer<typeof VerifyResetCodeSchema>;
export type ResetPasswordSchemaType = z.infer<typeof ResetPasswordSchema>;
