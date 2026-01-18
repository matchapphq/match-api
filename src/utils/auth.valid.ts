import { z } from "zod";

export const RegisterRequestSchema = z.object({
    email: z.email().min(1, { message: "Email is required" }),
    username: z.string().min(1, { message: "Username is required" }).optional(),
    firstName: z.string().min(1, { message: "First name is required" }),
    lastName: z.string().min(1, { message: "Last name is required" }),
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
    email: z.email().min(1, { message: "Email is required" }),
    password: z.string().min(1, { message: "Password is required" }),
})

export type RegisterRequestSchemaType = z.infer<typeof RegisterRequestSchema>;