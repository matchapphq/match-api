import { VenueRepository } from "../../repository/venue.repository";
import { FavoritesRepository } from "../../repository/favorites.repository";
import { AnalyticsRepository } from "../../repository/analytics.repository";
import type { CreateVenueInput, UpdateVenueInput, GetVenuesQuery } from "../../types/venue.types";

export class VenuesLogic {
    constructor(
        private readonly venueRepository: VenueRepository,
        private readonly favoritesRepository: FavoritesRepository,
        private readonly analyticsRepository: AnalyticsRepository,
    ) {}

    async findAll(query: GetVenuesQuery) {
        return await this.venueRepository.findAll(query);
    }

    async getNearby(lat: string, lng: string, radius: string = "5000") {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        const radiusMeters = parseFloat(radius);
        const radiusKm = radiusMeters / 1000;

        const result = await this.venueRepository.findAll({
            lat: latitude,
            lng: longitude,
            distance_km: radiusKm,
            sort: 'distance',
            limit: 50, // Get more for nearby
        });
        
        return result.data.map((venue: any) => ({
            ...venue,
            distance: parseFloat(this.calculateDistance(
                latitude,
                longitude,
                venue.latitude,
                venue.longitude,
            ).toFixed(2)),
        }));
    }

    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; 
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
                Math.cos(this.toRad(lat2)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
    }

    public async create(userId: string, body: CreateVenueInput) {
        return await this.venueRepository.create(userId, body);
    }

    async update(userId: string, venueId: string, body: UpdateVenueInput) {
        const existing = await this.venueRepository.findById(venueId);
        if (!existing) throw new Error("VENUE_NOT_FOUND");
        if (existing.owner_id !== userId) throw new Error("FORBIDDEN");

        return await this.venueRepository.update(venueId, body);
    }

    async delete(userId: string, venueId: string) {
        const existing = await this.venueRepository.findById(venueId);
        if (!existing) throw new Error("VENUE_NOT_FOUND");
        if (existing.owner_id !== userId) throw new Error("FORBIDDEN");

        return await this.venueRepository.softDelete(venueId);
    }

    async getDetails(venueId: string, userId?: string, ip?: string, userAgent?: string) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) throw new Error("VENUE_NOT_FOUND");

        // Track view event
        this.analyticsRepository.trackEvent({
            venue_id: venueId,
            user_id: userId,
            event_type: 'venue_view',
            event_name: 'View Venue Details',
            user_agent: userAgent,
            ip_address: ip,
        }).catch(err => console.error("Failed to track view event:", err));

        return venue;
    }

    async getPhotos(venueId: string) {
        return await this.venueRepository.getPhotos(venueId);
    }

    async uploadPhoto(userId: string, venueId: string, body: any) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) throw new Error("VENUE_NOT_FOUND");
        if (venue.owner_id !== userId) throw new Error("FORBIDDEN");

        return await this.venueRepository.addPhoto(venueId, {
            ...body,
            uploaded_by: userId,
        });
    }

    async deletePhoto(userId: string, venueId: string, photoId: string) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) throw new Error("VENUE_NOT_FOUND");
        if (venue.owner_id !== userId) throw new Error("FORBIDDEN");

        const deleted = await this.venueRepository.deletePhoto(photoId, venueId);
        if (!deleted) throw new Error("PHOTO_NOT_FOUND");
        return true;
    }

    async setPrimaryPhoto(userId: string, venueId: string, photoId: string) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) throw new Error("VENUE_NOT_FOUND");
        if (venue.owner_id !== userId) throw new Error("FORBIDDEN");

        const photo = await this.venueRepository.getPhoto(photoId, venueId);
        if (!photo) throw new Error("PHOTO_NOT_FOUND");

        return await this.venueRepository.setPrimaryPhoto(photoId, venueId);
    }

    async getOpeningHours(venueId: string) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) throw new Error("VENUE_NOT_FOUND");

        return (venue as any).opening_hours || {
            monday: { open: "09:00", close: "23:00", closed: false },
            tuesday: { open: "09:00", close: "23:00", closed: false },
            wednesday: { open: "09:00", close: "23:00", closed: false },
            thursday: { open: "09:00", close: "23:00", closed: false },
            friday: { open: "09:00", close: "00:00", closed: false },
            saturday: { open: "10:00", close: "00:00", closed: false },
            sunday: { open: "10:00", close: "22:00", closed: false },
        };
    }

    async updateOpeningHours(userId: string, venueId: string, opening_hours: any) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) throw new Error("VENUE_NOT_FOUND");
        if (venue.owner_id !== userId) throw new Error("FORBIDDEN");

        return await this.venueRepository.update(venueId, { opening_hours } as any);
    }

    async getOpeningHoursExceptions(venueId: string, options?: any) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) throw new Error("VENUE_NOT_FOUND");

        return await this.venueRepository.getOpeningHoursExceptions(venueId, options);
    }

    async addOpeningHoursException(userId: string, venueId: string, body: any) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) throw new Error("VENUE_NOT_FOUND");
        if (venue.owner_id !== userId) throw new Error("FORBIDDEN");

        const exceptionDate = new Date(body.date);
        if (exceptionDate < new Date()) throw new Error("DATE_IN_PAST");

        const existing = await this.venueRepository.getOpeningHoursExceptionByDate(venueId, exceptionDate);
        if (existing) throw new Error("EXCEPTION_EXISTS");

        return await this.venueRepository.addOpeningHoursException(venueId, {
            ...body,
            date: exceptionDate,
        });
    }

    async deleteOpeningHoursException(userId: string, venueId: string, exceptionId: string) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) throw new Error("VENUE_NOT_FOUND");
        if (venue.owner_id !== userId) throw new Error("FORBIDDEN");

        const deleted = await this.venueRepository.deleteOpeningHoursException(exceptionId, venueId);
        if (!deleted) throw new Error("EXCEPTION_NOT_FOUND");
        return true;
    }

    async getMenu(venueId: string) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) throw new Error("VENUE_NOT_FOUND");
        return (venue as any).menu || [];
    }

    async updateMenu(userId: string, venueId: string, menu: any) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) throw new Error("VENUE_NOT_FOUND");
        if (venue.owner_id !== userId) throw new Error("FORBIDDEN");

        return await this.venueRepository.update(venueId, { menu } as any);
    }

    async updateBookingMode(userId: string, venueId: string, booking_mode: any) {
        const existing = await this.venueRepository.findById(venueId);
        if (!existing) throw new Error("VENUE_NOT_FOUND");
        if (existing.owner_id !== userId) throw new Error("FORBIDDEN");

        return await this.venueRepository.update(venueId, { booking_mode });
    }

    async getAllAmenities() {
        return await this.venueRepository.getAllAmenities();
    }

    async getVenueAmenities(venueId: string) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) throw new Error("VENUE_NOT_FOUND");
        return await this.venueRepository.getVenueAmenities(venueId);
    }

    async setVenueAmenities(userId: string, venueId: string, amenities: string[]) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) throw new Error("VENUE_NOT_FOUND");
        if (venue.owner_id !== userId) throw new Error("FORBIDDEN");

        return await this.venueRepository.setVenueAmenities(venueId, amenities);
    }

    async addFavorite(userId: string, venueId: string, note?: string) {
        const result = await this.favoritesRepository.addFavorite(userId, venueId, note);
        if (!result.success) {
            if (result.error === 'venue_not_found') throw new Error("VENUE_NOT_FOUND");
            if (result.error === 'already_favorited') throw new Error("ALREADY_FAVORITED");
            throw new Error("FAILED_TO_ADD_FAVORITE");
        }
        return result;
    }

    async removeFavorite(userId: string, venueId: string) {
        await this.favoritesRepository.removeFavorite(userId, venueId);
        return true;
    }

    async updateFavoriteNote(userId: string, venueId: string, note: string | null) {
        const updated = await this.favoritesRepository.updateNote(userId, venueId, note);
        if (!updated) throw new Error("FAVORITE_NOT_FOUND");
        return updated;
    }

    async checkFavorite(userId: string, venueId: string) {
        return await this.favoritesRepository.getFavorite(userId, venueId);
    }

    async getMatches(venueId: string, upcomingOnly: boolean) {
        const venue = await this.venueRepository.findById(venueId);
        if (!venue) throw new Error("VENUE_NOT_FOUND");

        const venueMatches = await this.venueRepository.getVenueMatches(venueId, { upcomingOnly });

        return venueMatches.map((vm: any) => ({
            id: vm.match?.id,
            scheduled_at: vm.match?.scheduled_at,
            status: vm.match?.status,
            homeTeam: vm.match?.homeTeam ? {
                id: vm.match.homeTeam.id,
                name: vm.match.homeTeam.name,
                logo_url: vm.match.homeTeam.logo_url,
                short_name: vm.match.homeTeam.short_name,
            } : null,
            awayTeam: vm.match?.awayTeam ? {
                id: vm.match.awayTeam.id,
                name: vm.match.awayTeam.name,
                logo_url: vm.match.awayTeam.logo_url,
                short_name: vm.match.awayTeam.short_name,
            } : null,
            league: vm.match?.league ? {
                id: vm.match.league.id,
                name: vm.match.league.name,
                logo_url: vm.match.league.logo_url,
            } : null,
            home_team_score: vm.match?.home_team_score,
            away_team_score: vm.match?.away_team_score,
            venue_match: {
                id: vm.id,
                total_capacity: vm.total_capacity,
                available_capacity: vm.available_capacity,
                allows_reservations: vm.allows_reservations,
                is_featured: vm.is_featured,
                is_boosted: vm.is_boosted,
            },
        }));
    }
}
