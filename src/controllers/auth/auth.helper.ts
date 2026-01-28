
import type AuthRepository from "../../repository/auth/auth.repository"
import type { SavePreferencesData } from "../../repository/auth/auth.repository"
import type { RegisterRequestSchemaType } from "../../utils/auth.valid"

export async function userOnaboarding(body: RegisterRequestSchemaType, _authRepository: AuthRepository, userId: string): Promise<void> {
    const userPreferences: SavePreferencesData = {
        home_lat: body.home_lat || undefined,
        home_lng: body.home_lng || undefined,
        budget: body.budget || undefined,
        ambiances: body.ambiances || [],
        venue_types: body.venue_types || [],
        fav_sports: body.fav_sports || [],
        fav_team_ids: body.fav_team_ids || []
    }
    await _authRepository.savePreferences(userId, userPreferences);
    return;
}