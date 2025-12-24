/**
 * Comprehensive Seed Script for Match App
 * Populates the database with realistic fake data for testing and development.
 * 
 * Prerequisites: Run seed-sports.ts first to populate sports, leagues, and teams.
 * 
 * Run with: bun run scripts/seed-data.ts
 */

import { db } from "../src/config/config.db";
import { usersTable, userPreferencesTable } from "../src/config/db/user.table";
import { subscriptionsTable } from "../src/config/db/subscriptions.table";
import { venuesTable, type OpeningHours, type VenueMenu } from "../src/config/db/venues.table";
import { venuePhotosTable } from "../src/config/db/venue-photos.table";
import { tablesTable } from "../src/config/db/tables.table";
import { matchesTable, venueMatchesTable } from "../src/config/db/matches.table";
import { reservationsTable } from "../src/config/db/reservations.table";
import { reviewsTable } from "../src/config/db/reviews.table";
import { notificationsTable } from "../src/config/db/notifications.table";
import { userFavoriteVenuesTable } from "../src/config/db/user-favorites.table";
import { leaguesTable, teamsTable, type Team } from "../src/config/db/sports.table";
import { eq, sql } from "drizzle-orm";
import { password } from "bun";

// ============================================
// HELPER FUNCTIONS
// ============================================

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randomElements<T>(arr: readonly T[], count: number): T[] {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function generateFutureDate(daysAhead: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    date.setHours(randomInt(14, 22), 0, 0, 0);
    return date;
}

function generatePastDate(daysAgo: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
}

// ============================================
// DATA TEMPLATES
// ============================================

const firstNames = [
    "James", "Emma", "Liam", "Olivia", "Noah", "Ava", "Oliver", "Isabella",
    "Lucas", "Sophia", "Mason", "Mia", "Ethan", "Charlotte", "Aiden", "Amelia",
    "Miguel", "Sofia", "Carlos", "Valentina", "João", "Maria", "Pedro", "Ana"
];

const lastNames = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Santos", "Silva", "Ferreira", "Costa", "Oliveira", "Pereira", "Martins"
];

const venueNames = [
    "The Sports Den", "Goal Line Bar", "Champions Pub", "The Final Whistle",
    "Victory Lounge", "The Kickoff", "Stadium View", "Corner Flag Cafe",
    "The Penalty Box", "Hat Trick Tavern", "Golden Boot Bar", "The Offside",
    "Pitch Perfect Pub", "The Derby Room", "League Leaders", "The Trophy Room",
    "Full Time Sports Bar", "The Dugout", "Extra Time Lounge", "The Referee"
];

const cities = [
    { name: "Lisbon", country: "Portugal", lat: 38.7223, lng: -9.1393 },
    { name: "Porto", country: "Portugal", lat: 41.1579, lng: -8.6291 },
    { name: "Madrid", country: "Spain", lat: 40.4168, lng: -3.7038 },
    { name: "Barcelona", country: "Spain", lat: 41.3851, lng: 2.1734 },
    { name: "London", country: "UK", lat: 51.5074, lng: -0.1278 },
    { name: "Manchester", country: "UK", lat: 53.4808, lng: -2.2426 },
    { name: "Milan", country: "Italy", lat: 45.4642, lng: 9.1900 },
    { name: "Munich", country: "Germany", lat: 48.1351, lng: 11.5820 },
];

const venueTypes = ['bar', 'restaurant', 'sports_bar', 'pub', 'lounge', 'cafe'] as const;

const defaultOpeningHours: OpeningHours = [
    { day_of_week: 0, is_closed: true, periods: [] },
    { day_of_week: 1, is_closed: false, periods: [{ open: "11:00", close: "23:00" }] },
    { day_of_week: 2, is_closed: false, periods: [{ open: "11:00", close: "23:00" }] },
    { day_of_week: 3, is_closed: false, periods: [{ open: "11:00", close: "23:00" }] },
    { day_of_week: 4, is_closed: false, periods: [{ open: "11:00", close: "00:00" }] },
    { day_of_week: 5, is_closed: false, periods: [{ open: "11:00", close: "01:00" }] },
    { day_of_week: 6, is_closed: false, periods: [{ open: "12:00", close: "01:00" }] },
];

const sampleMenu: VenueMenu = [
    { name: "Nachos Supreme", description: "Loaded nachos with cheese, jalapeños, and guacamole", price: 12.99, currency: "EUR", category: "Appetizers", is_available: true },
    { name: "Buffalo Wings", description: "Crispy wings with your choice of sauce", price: 14.99, currency: "EUR", category: "Appetizers", is_available: true },
    { name: "Classic Burger", description: "Angus beef patty with lettuce, tomato, and special sauce", price: 16.99, currency: "EUR", category: "Mains", is_available: true },
    { name: "Fish & Chips", description: "Beer-battered cod with hand-cut fries", price: 18.99, currency: "EUR", category: "Mains", is_available: true },
    { name: "Caesar Salad", description: "Romaine lettuce with parmesan and croutons", price: 11.99, currency: "EUR", category: "Salads", is_available: true },
    { name: "Draft Beer", description: "Local craft beer on tap", price: 5.99, currency: "EUR", category: "Drinks", is_available: true },
    { name: "Soft Drinks", description: "Coca-Cola, Sprite, Fanta", price: 3.50, currency: "EUR", category: "Drinks", is_available: true },
];

const reviewTitles = [
    "Great atmosphere for watching the game!",
    "Perfect sports bar experience",
    "Good food, great screens",
    "Love this place!",
    "Best place to watch football",
    "Amazing match day experience",
    "Fantastic venue for sports fans",
    "Will definitely come back",
    "Decent place, could be better",
    "Nice spot for the game"
];

const reviewContents = [
    "Had an amazing time watching the match here. The screens are huge and the atmosphere was electric. Staff were friendly and the food came quickly. Highly recommend!",
    "This is now my go-to place for watching big games. The sound system is great and they have multiple screens so you never miss any action.",
    "Good selection of beers and the wings were delicious. Got a bit crowded during the second half but that's expected for a big game.",
    "Friendly staff, reasonable prices, and a great view of the screens from every seat. What more could you ask for?",
    "The venue was packed but service was still excellent. Loved the atmosphere and the fans around were all great.",
    "Solid sports bar with good food and drinks. The TVs could be a bit bigger but overall a good experience.",
    "Perfect for watching matches with friends. We had a reserved table which was great for a group of 6.",
    "Nice place with a good vibe. Food was tasty and drinks were cold. Will be back for the next big game!",
];

// ============================================
// SEED FUNCTIONS
// ============================================

async function seedUsers(): Promise<string[]> {
    console.log("\n👤 Seeding users...");
    
    const hashedPassword = await password.hash("Password123!", { algorithm: "bcrypt", cost: 10 });
    const userIds: string[] = [];
    
    // Create admin user
    const [admin] = await db.insert(usersTable).values({
        email: "admin@matchapp.com",
        password_hash: hashedPassword,
        first_name: "Admin",
        last_name: "User",
        phone: "+351910000000",
        role: "admin",
        is_verified: true,
        is_active: true,
    }).onConflictDoNothing().returning();
    
    if (admin) {
        userIds.push(admin.id);
        console.log(`  ✅ Created admin: ${admin.email}`);
    }
    
    // Create venue owner users
    for (let i = 0; i < 10; i++) {
        const firstName = randomElement(firstNames);
        const lastName = randomElement(lastNames);
        const email = `owner${i + 1}@matchapp.com`;
        
        const [owner] = await db.insert(usersTable).values({
            email,
            password_hash: hashedPassword,
            first_name: firstName,
            last_name: lastName,
            phone: `+351911${String(i).padStart(6, '0')}`,
            role: "venue_owner",
            is_verified: true,
            is_active: true,
        }).onConflictDoNothing().returning();
        
        if (owner) {
            userIds.push(owner.id);
            console.log(`  ✅ Created venue owner: ${owner.email}`);
        }
    }
    
    // Create regular users
    for (let i = 0; i < 30; i++) {
        const firstName = randomElement(firstNames);
        const lastName = randomElement(lastNames);
        const email = `user${i + 1}@matchapp.com`;
        
        const [user] = await db.insert(usersTable).values({
            email,
            password_hash: hashedPassword,
            first_name: firstName,
            last_name: lastName,
            phone: `+351912${String(i).padStart(6, '0')}`,
            role: "user",
            is_verified: i < 25, // Some unverified users
            is_active: true,
        }).onConflictDoNothing().returning();
        
        if (user) {
            userIds.push(user.id);
            
            // Create user preferences
            await db.insert(userPreferencesTable).values({
                user_id: user.id,
                language: randomElement(["en", "pt", "es"]),
                timezone: "Europe/Lisbon",
                fav_sports: randomElements(["football", "basketball", "tennis"], randomInt(1, 3)),
            }).onConflictDoNothing();
        }
    }
    
    console.log(`  📊 Total users created: ${userIds.length}`);
    return userIds;
}

async function seedSubscriptionsAndVenues(ownerIds: string[]): Promise<{ subscriptionIds: string[], venueIds: string[] }> {
    console.log("\n🏢 Seeding subscriptions and venues...");
    
    const subscriptionIds: string[] = [];
    const venueIds: string[] = [];
    const plans = ['basic', 'pro', 'enterprise'] as const;
    
    for (let i = 0; i < ownerIds.length; i++) {
        const ownerId = ownerIds[i]!;
        const plan = randomElement(plans);
        const city = cities[i % cities.length]!;
        const venueName = venueNames[i % venueNames.length]!;
        
        // Create subscription
        const [subscription] = await db.insert(subscriptionsTable).values({
            user_id: ownerId,
            plan,
            status: "active",
            current_period_start: generatePastDate(randomInt(1, 30)),
            current_period_end: generateFutureDate(randomInt(30, 365)),
            price: plan === 'basic' ? "29.99" : plan === 'pro' ? "79.99" : "199.99",
            currency: "EUR",
            stripe_subscription_id: `sub_${ownerId.slice(0, 8)}${i}`,
            stripe_payment_method_id: `pm_${ownerId.slice(0, 8)}${i}`,
            max_monthly_reservations: plan === 'basic' ? 100 : plan === 'pro' ? 500 : 9999,
            advanced_analytics: plan !== 'basic',
            priority_support: plan === 'enterprise',
        }).onConflictDoNothing().returning();
        
        if (!subscription) continue;
        subscriptionIds.push(subscription.id);
        
        // Create venue
        const latOffset = (Math.random() - 0.5) * 0.05;
        const lngOffset = (Math.random() - 0.5) * 0.05;
        const lat = city.lat + latOffset;
        const lng = city.lng + lngOffset;
        
        const [venue] = await db.insert(venuesTable).values({
            owner_id: ownerId,
            subscription_id: subscription.id,
            name: `${venueName} ${city.name}`,
            description: `The best place to watch sports in ${city.name}. Great atmosphere, cold drinks, and the best screens in town.`,
            type: randomElement(venueTypes),
            street_address: `${randomInt(1, 200)} ${randomElement(["Main St", "Sports Ave", "Stadium Rd", "Central Blvd"])}`,
            city: city.name,
            state_province: city.name,
            postal_code: `${randomInt(1000, 9999)}-${randomInt(100, 999)}`,
            country: city.country,
            location: sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`,
            latitude: lat,
            longitude: lng,
            phone: `+351${randomInt(210000000, 299999999)}`,
            email: `contact@${venueName.toLowerCase().replace(/\s+/g, '')}.com`,
            website: `https://${venueName.toLowerCase().replace(/\s+/g, '')}.com`,
            opening_hours: defaultOpeningHours,
            capacity: randomInt(50, 200),
            has_terrace: Math.random() > 0.5,
            has_wifi: true,
            has_parking: Math.random() > 0.3,
            has_wheelchair_access: Math.random() > 0.4,
            menu: sampleMenu,
            status: "approved",
            is_active: true,
            is_verified: true,
            subscription_status: "active",
            subscription_level: plan,
            average_rating: String(randomInt(35, 50) / 10),
            total_reviews: randomInt(5, 50),
        }).onConflictDoNothing().returning();
        
        if (!venue) continue;
        venueIds.push(venue.id);
        console.log(`  ✅ Created venue: ${venue.name}`);
        
        // Create tables for this venue
        const tableCount = randomInt(8, 20);
        for (let t = 0; t < tableCount; t++) {
            await db.insert(tablesTable).values({
                venue_id: venue.id,
                name: t < 5 ? `Table ${t + 1}` : `Booth ${String.fromCharCode(65 + t - 5)}`,
                capacity: randomInt(2, 8),
                is_accessible: t === 0, // First table is accessible
            }).onConflictDoNothing();
        }
        
        // Create venue photos
        const photoUrls = [
            "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800",
            "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800",
            "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800",
        ];
        for (const [p, photoUrl] of photoUrls.entries()) {
            await db.insert(venuePhotosTable).values({
                venue_id: venue.id,
                photo_url: photoUrl,
                alt_text: p === 0 ? "Main area" : p === 1 ? "Bar section" : "Outdoor terrace",
                display_order: p,
                is_primary: p === 0,
            }).onConflictDoNothing();
        }
    }
    
    console.log(`  📊 Total venues created: ${venueIds.length}`);
    return { subscriptionIds, venueIds };
}

async function seedMatches(): Promise<string[]> {
    console.log("\n⚽ Seeding matches...");
    
    const matchIds: string[] = [];
    
    // Get existing leagues and teams
    const leagues = await db.select().from(leaguesTable).limit(10);
    
    if (leagues.length === 0) {
        console.log("  ⚠️ No leagues found. Please run seed-sports.ts first!");
        return matchIds;
    }
    
    for (const league of leagues) {
        const teams = await db.select().from(teamsTable).where(eq(teamsTable.league_id, league.id));
        
        if (teams.length < 2) continue;
        
        // Create 3-5 matches per league
        const matchCount = randomInt(3, 5);
        for (let m = 0; m < matchCount; m++) {
            const selectedTeams = randomElements(teams, 2);
            const homeTeam = selectedTeams[0]!;
            const awayTeam = selectedTeams[1]!;
            const scheduledAt = generateFutureDate(randomInt(1, 30));
            
            const [match] = await db.insert(matchesTable).values({
                league_id: league.id,
                home_team_id: homeTeam.id,
                away_team_id: awayTeam.id,
                status: "scheduled",
                scheduled_at: scheduledAt,
                round_number: randomInt(1, 38),
                venue_name: `${homeTeam.name} Stadium`,
                description: `${homeTeam.name} vs ${awayTeam.name}`,
            }).onConflictDoNothing().returning();
            
            if (match) {
                matchIds.push(match.id);
            }
        }
        
        // Create some past matches (finished)
        for (let m = 0; m < 2; m++) {
            const pastSelectedTeams = randomElements(teams, 2);
            const homeTeam = pastSelectedTeams[0]!;
            const awayTeam = pastSelectedTeams[1]!;
            const scheduledAt = generatePastDate(randomInt(1, 14));
            
            const [match] = await db.insert(matchesTable).values({
                league_id: league.id,
                home_team_id: homeTeam.id,
                away_team_id: awayTeam.id,
                status: "finished",
                scheduled_at: scheduledAt,
                started_at: scheduledAt,
                finished_at: new Date(scheduledAt.getTime() + 2 * 60 * 60 * 1000),
                home_team_score: randomInt(0, 4),
                away_team_score: randomInt(0, 4),
                round_number: randomInt(1, 38),
                venue_name: `${homeTeam.name} Stadium`,
            }).onConflictDoNothing().returning();
            
            if (match) {
                matchIds.push(match.id);
            }
        }
    }
    
    console.log(`  📊 Total matches created: ${matchIds.length}`);
    return matchIds;
}

async function seedVenueMatches(venueIds: string[], matchIds: string[]): Promise<string[]> {
    console.log("\n📺 Seeding venue matches...");
    
    const venueMatchIds: string[] = [];
    
    if (matchIds.length === 0 || venueIds.length === 0) {
        console.log("  ⚠️ No matches or venues found. Skipping venue matches.");
        return venueMatchIds;
    }
    
    // Each venue broadcasts 3-8 random matches
    for (const venueId of venueIds) {
        const selectedMatches = randomElements(matchIds, randomInt(3, Math.min(8, matchIds.length)));
        
        for (const matchId of selectedMatches) {
            const totalCapacity = randomInt(30, 100);
            const reservedCapacity = randomInt(0, Math.floor(totalCapacity * 0.6));
            
            const [venueMatch] = await db.insert(venueMatchesTable).values({
                venue_id: venueId,
                match_id: matchId,
                total_capacity: totalCapacity,
                available_capacity: totalCapacity - reservedCapacity,
                reserved_capacity: reservedCapacity,
                max_group_size: randomInt(6, 12),
                allows_reservations: true,
                is_active: true,
                is_featured: Math.random() > 0.7,
                show_on_map: true,
                estimated_crowd_level: randomElement(["low", "medium", "high"]),
            }).onConflictDoNothing().returning();
            
            if (venueMatch) {
                venueMatchIds.push(venueMatch.id);
            }
        }
    }
    
    console.log(`  📊 Total venue matches created: ${venueMatchIds.length}`);
    return venueMatchIds;
}

async function seedReservations(userIds: string[], venueMatchIds: string[]): Promise<void> {
    console.log("\n🎫 Seeding reservations...");
    
    if (venueMatchIds.length === 0) {
        console.log("  ⚠️ No venue matches found. Skipping reservations.");
        return;
    }
    
    // Filter to get only regular users (not admins or venue owners)
    const regularUsers = userIds.slice(11); // Skip admin and 10 venue owners
    let reservationCount = 0;
    
    const statuses = ['pending', 'confirmed', 'completed', 'canceled'] as const;
    
    for (const userId of regularUsers) {
        // Each user makes 0-3 reservations
        const numReservations = randomInt(0, 3);
        const selectedVenueMatches = randomElements(venueMatchIds, numReservations);
        
        for (const venueMatchId of selectedVenueMatches) {
            const status = randomElement(statuses);
            const partySize = randomInt(1, 6);
            
            await db.insert(reservationsTable).values({
                user_id: userId,
                venue_match_id: venueMatchId,
                party_size: partySize,
                status,
                seat_ids: [],
                quantity: partySize,
                special_requests: Math.random() > 0.7 ? "Window seat preferred" : null,
                checked_in_at: status === 'completed' ? generatePastDate(randomInt(1, 7)) : null,
                completed_at: status === 'completed' ? generatePastDate(randomInt(1, 7)) : null,
                canceled_at: status === 'canceled' ? generatePastDate(randomInt(1, 7)) : null,
                canceled_reason: status === 'canceled' ? "Plans changed" : null,
            }).onConflictDoNothing();
            
            reservationCount++;
        }
    }
    
    console.log(`  📊 Total reservations created: ${reservationCount}`);
}

async function seedReviews(userIds: string[], venueIds: string[]): Promise<void> {
    console.log("\n⭐ Seeding reviews...");
    
    if (venueIds.length === 0) {
        console.log("  ⚠️ No venues found. Skipping reviews.");
        return;
    }
    
    const regularUsers = userIds.slice(11);
    let reviewCount = 0;
    
    for (const userId of regularUsers) {
        // Each user reviews 0-3 venues
        const numReviews = randomInt(0, 3);
        const selectedVenues = randomElements(venueIds, numReviews);
        
        for (const venueId of selectedVenues) {
            const rating = randomInt(3, 5);
            
            await db.insert(reviewsTable).values({
                user_id: userId,
                venue_id: venueId,
                rating,
                title: randomElement(reviewTitles),
                content: randomElement(reviewContents),
                atmosphere_rating: randomInt(3, 5),
                food_rating: randomInt(3, 5),
                service_rating: randomInt(3, 5),
                value_rating: randomInt(3, 5),
                is_verified_purchase: Math.random() > 0.3,
                helpful_count: randomInt(0, 20),
            }).onConflictDoNothing();
            
            reviewCount++;
        }
    }
    
    console.log(`  📊 Total reviews created: ${reviewCount}`);
}

async function seedNotifications(userIds: string[]): Promise<void> {
    console.log("\n🔔 Seeding notifications...");
    
    let notificationCount = 0;
    const types = [
        'reservation_confirmed',
        'reservation_reminder',
        'match_starting',
        'promotional',
        'system',
    ] as const;
    type NotificationType = typeof types[number];

    const messages: Record<NotificationType, string> = {
        reservation_confirmed: "Your reservation has been confirmed! See you at the match.",
        reservation_reminder: "Reminder: Your reservation is coming up in 2 hours.",
        match_starting: "The match you're interested in starts in 30 minutes!",
        promotional: "Special offer: Get 20% off your next visit!",
        system: "Welcome to Match App! Start exploring venues near you.",
    };
    
    for (const userId of userIds) {
        // Each user gets 2-5 notifications
        const numNotifications = randomInt(2, 5);
        
        for (let n = 0; n < numNotifications; n++) {
            const type: NotificationType = randomElement(types);
            
            await db.insert(notificationsTable).values({
                user_id: userId,
                type,
                title: type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                message: messages[type],
                is_read: Math.random() > 0.4,
                read_at: Math.random() > 0.4 ? generatePastDate(randomInt(0, 7)) : null,
                send_email: type === 'reservation_confirmed',
                send_push: true,
            }).onConflictDoNothing();
            
            notificationCount++;
        }
    }
    
    console.log(`  📊 Total notifications created: ${notificationCount}`);
}

async function seedUserFavorites(userIds: string[], venueIds: string[]): Promise<void> {
    console.log("\n❤️ Seeding user favorites...");
    
    if (venueIds.length === 0) {
        console.log("  ⚠️ No venues found. Skipping favorites.");
        return;
    }
    
    const regularUsers = userIds.slice(11);
    let favoriteCount = 0;
    
    for (const userId of regularUsers) {
        // Each user favorites 0-4 venues
        const numFavorites = randomInt(0, 4);
        const selectedVenues = randomElements(venueIds, numFavorites);
        
        for (const venueId of selectedVenues) {
            await db.insert(userFavoriteVenuesTable).values({
                user_id: userId,
                venue_id: venueId,
            }).onConflictDoNothing();
            
            favoriteCount++;
        }
    }
    
    console.log(`  📊 Total favorites created: ${favoriteCount}`);
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function seedAll() {
    console.log("🌱 Starting comprehensive database seed...\n");
    console.log("========================================");
    
    try {
        // 1. Seed users
        const userIds = await seedUsers();
        
        // Get venue owner IDs (positions 1-10 in the array)
        const venueOwnerIds = userIds.slice(1, 11);
        
        // 2. Seed subscriptions and venues
        const { venueIds } = await seedSubscriptionsAndVenues(venueOwnerIds);
        
        // 3. Seed matches
        const matchIds = await seedMatches();
        
        // 4. Seed venue matches
        const venueMatchIds = await seedVenueMatches(venueIds, matchIds);
        
        // 5. Seed reservations
        await seedReservations(userIds, venueMatchIds);
        
        // 6. Seed reviews
        await seedReviews(userIds, venueIds);
        
        // 7. Seed notifications
        await seedNotifications(userIds);
        
        // 8. Seed user favorites
        await seedUserFavorites(userIds, venueIds);
        
        console.log("\n========================================");
        console.log("🎉 Database seed completed successfully!");
        console.log("========================================\n");
        
        console.log("📋 Test Credentials:");
        console.log("   Admin:       admin@matchapp.com / Password123!");
        console.log("   Venue Owner: owner1@matchapp.com / Password123!");
        console.log("   User:        user1@matchapp.com / Password123!");
        console.log("");
        
    } catch (error) {
        console.error("\n❌ Seed failed:", error);
        throw error;
    }
}

// Run seed
seedAll()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exit(1);
    });
