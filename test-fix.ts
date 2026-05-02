import { challengeRepository } from "./src/repository/challenge.repository";

async function testLeaderboard() {
    console.log("Testing leaderboard query...");
    try {
        const leaderboard = await challengeRepository.getLeaderboard();
        console.log("Leaderboard fetched successfully:", leaderboard.length, "entries");
        if (leaderboard.length > 0 && leaderboard[0]) {
            console.log("First entry name:", leaderboard[0].name);
        }
    } catch (error) {
        console.error("Leaderboard query failed:", error);
        process.exit(1);
    }
}

testLeaderboard();
