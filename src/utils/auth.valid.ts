import { z } from "zod";

export const RegisterRequestSchema = z.object({
    email: z.email().min(1, { message: "Email is required" }),
    username: z.string().min(1, { message: "Username is required" }),
    lastName: z.string().min(1),
    firstName: z.string().min(1),
    password: z.string().min(1, { message: "Password is required" }),
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
