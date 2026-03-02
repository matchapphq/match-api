import {z} from "zod";

export const CreateReviewSchema = z.object({
    venue_id: z.uuid(),
    rating: z.number().min(1).max(5),
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    atmosphere_rating: z.number().min(1).max(5).optional(),
    food_rating: z.number().min(1).max(5).optional(),
    service_rating: z.number().min(1).max(5).optional(),
    value_rating: z.number().min(1).max(5).optional(),
});

export const GetVenuesReviewsSchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
});

