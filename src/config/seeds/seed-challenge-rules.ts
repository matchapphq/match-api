import { db } from "../config.db";
import { fidelityPointRulesTable } from "../db/fidelity.table";
import { fidelityLevelsTable } from "../db/fidelity.table";

async function seedChallengeRules() {
    console.log("🌱 Seeding Challenge Bêta rules...");

    const rules = [
        // Acquisition
        { action_key: "BETA_SIGNUP", display_name: "Création de compte", base_points: 2 },
        { action_key: "BETA_REFERRAL_SIGNUP", display_name: "Inscription via parrainage", base_points: 1 },
        { action_key: "BETA_PROFILE_COMPLETED", display_name: "Profil complété", base_points: 1 },
        { action_key: "BETA_REFERRAL_AWARD", display_name: "Parrainage réussi", base_points: 10 },
        { action_key: "BETA_REFERRAL_ACTIVE_7D", display_name: "Filleul actif 7 jours", base_points: 5 },
        { action_key: "BETA_REFERRAL_VISITOR", display_name: "Filleul visiteur", base_points: 10 },
        { action_key: "BETA_STORY_SHARE", display_name: "Partage Story Instagram", base_points: 15, max_per_week: 2 },
        
        // engagement
        { action_key: "BETA_VENUE_SCAN", display_name: "Scan QR Lieu", base_points: 10, max_per_day: 1 },
        { action_key: "BETA_REVIEW_SHORT", display_name: "Avis court", base_points: 3 },
        { action_key: "BETA_REVIEW_COMPLETE", display_name: "Avis complet", base_points: 5 },
        { action_key: "BETA_DAILY_CONNECTION", display_name: "Connexion quotidienne", base_points: 1 },
        { action_key: "BETA_STREAK_7D", display_name: "Bonus Streak 7j", base_points: 7 },
        { action_key: "BETA_STREAK_14D", display_name: "Bonus Streak 14j", base_points: 14 },
        
        // Improvement
        { action_key: "BETA_VENUE_SUGGESTION", display_name: "Suggestion d'établissement", base_points: 10 },
        { action_key: "BETA_BUG_REPORT", display_name: "Signalement de bug", base_points: 10 },
    ];

    for (const rule of rules) {
        await db.insert(fidelityPointRulesTable)
            .values(rule as any)
            .onConflictDoUpdate({
                target: fidelityPointRulesTable.action_key,
                set: { base_points: rule.base_points, display_name: rule.display_name }
            });
    }

    console.log("✅ Rules seeded.");

    console.log("🌱 Seeding Challenge Bêta Levels...");
    const levels = [
        { name: "Rookie Bêta", min_points: 0, rank: 1, color: "#9ca3af" },
        { name: "Supporter Bronze", min_points: 100, rank: 2, color: "#cd7f32" },
        { name: "Supporter Argent", min_points: 250, rank: 3, color: "#c0c0c0" },
        { name: "Supporter Or", min_points: 500, rank: 4, color: "#ffd700" },
        { name: "Légende Match", min_points: 1000, rank: 5, color: "#00FF00" },
    ];

    for (const level of levels) {
        await db.insert(fidelityLevelsTable)
            .values(level as any)
            .onConflictDoUpdate({
                target: fidelityLevelsTable.rank,
                set: { name: level.name, min_points: level.min_points, color: level.color }
            });
    }
    console.log("✅ Levels seeded.");
}

seedChallengeRules().catch(err => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
});
