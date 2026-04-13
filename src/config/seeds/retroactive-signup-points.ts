import { db } from "../config.db";
import { usersTable } from "../db/user.table";
import { fidelityPointTransactionsTable, fidelityPointRulesTable, fidelityUserStatsTable } from "../db/fidelity.table";
import { eq, sql, notInArray } from "drizzle-orm";

async function awardRetroactiveSignupPoints() {
    console.log("🚀 Starting retroactive signup points award...");

    // 1. Get the signup rule to make sure we use the right amount and description
    const [signupRule] = await db.select()
        .from(fidelityPointRulesTable)
        .where(eq(fidelityPointRulesTable.action_key, "BETA_SIGNUP"))
        .limit(1);

    if (!signupRule) {
        console.error("❌ BETA_SIGNUP rule not found. Please run the challenge seed first.");
        return;
    }

    const points = signupRule.base_points;
    const description = signupRule.display_name;

    // 2. Find users who already have a signup transaction to avoid double-awarding
    const usersWithPoints = db.select({ userId: fidelityPointTransactionsTable.user_id })
        .from(fidelityPointTransactionsTable)
        .where(eq(fidelityPointTransactionsTable.action_key, "BETA_SIGNUP"));

    // 3. Find all users NOT in that list
    const usersToAward = await db.select({
        id: usersTable.id,
        email: usersTable.email
    })
    .from(usersTable)
    .where(
        sql`${usersTable.id} NOT IN (SELECT user_id FROM ${fidelityPointTransactionsTable} WHERE action_key = 'BETA_SIGNUP')`
    );

    console.log(`found ${usersToAward.length} users to award.`);

    let count = 0;
    for (const user of usersToAward) {
        try {
            await db.transaction(async (tx) => {
                // Award the points
                await tx.insert(fidelityPointTransactionsTable).values({
                    user_id: user.id,
                    action_key: "BETA_SIGNUP",
                    reference_id: user.id, // Using user ID as reference for signup
                    reference_type: "user_signup",
                    points: points,
                    description: description,
                    idempotency_key: `${user.id}:BETA_SIGNUP:${user.id}`
                });

                // Update user total stats
                // We use a raw SQL increment to be safe with concurrent updates
                await tx.insert(fidelityUserStatsTable)
                    .values({
                        user_id: user.id,
                        total_points: points,
                        last_activity_date: new Date()
                    })
                    .onConflictDoUpdate({
                        target: fidelityUserStatsTable.user_id,
                        set: { 
                            total_points: sql`${fidelityUserStatsTable.total_points} + ${points}`,
                            last_activity_date: new Date()
                        }
                    });
            });
            count++;
            if (count % 10 === 0) console.log(`Processed ${count}/${usersToAward.length}...`);
        } catch (err) {
            console.error(`❌ Failed to award points to user ${user.id}:`, err);
        }
    }

    console.log(`✅ Finished! Awarded ${count} users with ${points} points each.`);
    process.exit(0);
}

awardRetroactiveSignupPoints().catch(err => {
    console.error("❌ Script failed:", err);
    process.exit(1);
});
