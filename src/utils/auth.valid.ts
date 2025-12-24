import { z } from "zod";

export const RegisterRequestSchema = z.object({
    email: z.email().min(1, { message: "Email is required" }),
    firstName: z.string().min(1, { message: "First name is required" }),
    lastName: z.string().min(1, { message: "Last name is required" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters" }),
    role: z.enum(['user', 'venue_owner', 'admin']).optional(),
    phone: z.string().optional(),
    favSports: z.array(z.string()).nullable().optional(),
    favTeamIds: z.array(z.string()).nullable().optional(),
    homeLat: z.number().nullable().optional(),
    homeLng: z.number().nullable().optional(),
})

export const LoginRequestSchema = z.object({
    email: z.email().min(1, { message: "Email is required" }),
    password: z.string().min(1, { message: "Password is required" }),
})
