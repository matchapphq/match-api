import { z } from "zod";

export const CreateVenueSchema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters"),
    address: z.string().min(5, "Address is required"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    capacity: z.number().int().positive(),
    maxSimultaneousBroadcasts: z.number().int().positive().optional(),
    type: z.enum(["bar", "restaurant", "fast_food", "nightclub", "cafe", "lounge", "pub", "sports_bar"]).default("bar"),
    description: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
    photos: z.array(z.object({
        url: z.string().url(),
        altText: z.string().optional(),
        isPrimary: z.boolean().optional()
    })).optional()
});

export const UpdateVenueSchema = CreateVenueSchema.partial();
