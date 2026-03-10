type VenueOperationalState = {
    is_active?: boolean | null;
    status?: string | null;
};

export function assertVenueIsActiveForOperations(venue: VenueOperationalState | null | undefined) {
    const isActive = venue?.is_active === true;
    const isApproved = venue?.status == null || venue.status === "approved";

    if (!isActive || !isApproved) {
        throw new Error("VENUE_INACTIVE_PAYMENT_REQUIRED");
    }
}
