import z from "zod";

export const BookingRequestSchema = z.object({
    name: z.string(),
    seats: z.number(),
    time: z.string()
})

export type BookingRequestSchemaType = z.infer<typeof BookingRequestSchema>;
