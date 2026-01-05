import { eq } from "drizzle-orm";
import { db } from "../config/config.db";
import { userPreferencesTable, type NewUserPreferences } from "../config/db/user.table";

export interface SavePreferencesData {
    ambiances?: string[];
    venue_types?: string[];
    budget?: string;
    home_lat?: number;
    home_lng?: number;
    fav_sports?: string[];
    fav_team_ids?: string[];
}

class OnboardingRepository {
    async savePreferences(userId: string, preferences: SavePreferencesData) {

        const existing = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.user_id, userId));

        const preferenceData: Partial<NewUserPreferences> = {
            home_lat: preferences.home_lat ?? undefined,
            home_lng: preferences.home_lng ?? undefined,
            fav_sports: preferences.fav_sports ?? undefined,
            fav_team_ids: preferences.fav_team_ids ?? undefined,
            ambiances: preferences.ambiances ?? undefined,
            venue_types: preferences.venue_types ?? undefined,
            budget: preferences.budget ?? undefined,
            updated_at: new Date()
        };

        if (existing.length > 0 && existing[0]) {
            return (await db.update(userPreferencesTable)
                .set(preferenceData)
                .where(eq(userPreferencesTable.id, existing[0].id))
                .returning())[0];
        } else {
            return (await db.insert(userPreferencesTable).values({
                user_id: userId,
                ...preferenceData,
            } as NewUserPreferences).returning())[0];
        }
    }
}

export default OnboardingRepository;
