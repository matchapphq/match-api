import { relations } from 'drizzle-orm';
import { usersTable, userPreferencesTable } from './user.table';
import { userAddressesTable } from './user-addresses.table';
import { userFavoriteVenuesTable } from './user-favorites.table';
import { subscriptionsTable } from './subscriptions.table';
import { venuesTable } from './venues.table';
import { venuePhotosTable } from './venue-photos.table';
import { sportsTable, leaguesTable, teamsTable } from './sports.table';
import { matchesTable, venueMatchesTable } from './matches.table';
import { seatsTable, seatHoldsTable } from './seats.table';
import { reservationsTable } from './reservations.table';
import { tablesTable } from './tables.table';
import { tableHoldsTable } from './table-holds.table';
import { waitlistTable } from './waitlist.table';
import { reviewsTable, reviewHelpfulTable } from './reviews.table';
import { notificationsTable, conversationsTable, messagesTable } from './notifications.table';
import { paymentMethodsTable, invoicesTable, transactionsTable } from './billing.table';
import { analyticsTable, auditLogsTable, bannedUsersTable } from './admin.table';
import { referralCodesTable, referralsTable, referralStatsTable, boostsTable } from './referral.table';
import { boostPurchasesTable, boostPricesTable, boostAnalyticsTable } from './boost.table';

export const usersRelations = relations(usersTable, ({ one, many }) => ({
    preferences: one(userPreferencesTable, {
        fields: [usersTable.id],
        references: [userPreferencesTable.user_id],
    }),
    addresses: many(userAddressesTable),
    favorites: many(userFavoriteVenuesTable),
    subscriptions: many(subscriptionsTable),
    venues: many(venuesTable), // Owned venues
    reservations: many(reservationsTable),
    notifications: many(notificationsTable),
    paymentMethods: many(paymentMethodsTable),
}));

export const userPreferencesRelations = relations(userPreferencesTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [userPreferencesTable.user_id],
        references: [usersTable.id],
    }),
}));

export const userAddressesRelations = relations(userAddressesTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [userAddressesTable.user_id],
        references: [usersTable.id],
    }),
}));

export const userFavoriteVenuesRelations = relations(userFavoriteVenuesTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [userFavoriteVenuesTable.user_id],
        references: [usersTable.id],
    }),
    venue: one(venuesTable, {
        fields: [userFavoriteVenuesTable.venue_id],
        references: [venuesTable.id],
    }),
}));

export const subscriptionsRelations = relations(subscriptionsTable, ({ one, many }) => ({
    user: one(usersTable, {
        fields: [subscriptionsTable.user_id],
        references: [usersTable.id],
    }),
    venues: many(venuesTable),
}));

export const venuesRelations = relations(venuesTable, ({ one, many }) => ({
    owner: one(usersTable, {
        fields: [venuesTable.owner_id],
        references: [usersTable.id],
    }),
    subscription: one(subscriptionsTable, {
        fields: [venuesTable.subscription_id],
        references: [subscriptionsTable.id],
    }),
    photos: many(venuePhotosTable),
    venueMatches: many(venueMatchesTable),
    reviews: many(reviewsTable),
}));

export const venuePhotosRelations = relations(venuePhotosTable, ({ one }) => ({
    venue: one(venuesTable, {
        fields: [venuePhotosTable.venue_id],
        references: [venuesTable.id],
    }),
}));

export const sportsRelations = relations(sportsTable, ({ many }) => ({
    leagues: many(leaguesTable),
}));

export const leaguesRelations = relations(leaguesTable, ({ one, many }) => ({
    sport: one(sportsTable, {
        fields: [leaguesTable.sport_id],
        references: [sportsTable.id],
    }),
    teams: many(teamsTable),
}));

export const teamsRelations = relations(teamsTable, ({ one }) => ({
    league: one(leaguesTable, {
        fields: [teamsTable.league_id],
        references: [leaguesTable.id],
    }),
}));

export const matchesRelations = relations(matchesTable, ({ one, many }) => ({
    league: one(leaguesTable, {
        fields: [matchesTable.league_id],
        references: [leaguesTable.id],
    }),
    homeTeam: one(teamsTable, {
        fields: [matchesTable.home_team_id],
        references: [teamsTable.id],
    }),
    awayTeam: one(teamsTable, {
        fields: [matchesTable.away_team_id],
        references: [teamsTable.id],
    }),
    venueMatches: many(venueMatchesTable),
}));

export const venueMatchesRelations = relations(venueMatchesTable, ({ one, many }) => ({
    venue: one(venuesTable, {
        fields: [venueMatchesTable.venue_id],
        references: [venuesTable.id],
    }),
    match: one(matchesTable, {
        fields: [venueMatchesTable.match_id],
        references: [matchesTable.id],
    }),
    reservations: many(reservationsTable),
    seatHolds: many(seatHoldsTable),
}));

export const seatHoldsRelations = relations(seatHoldsTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [seatHoldsTable.user_id],
        references: [usersTable.id],
    }),
    venueMatch: one(venueMatchesTable, {
        fields: [seatHoldsTable.venue_match_id],
        references: [venueMatchesTable.id],
    }),
}));

export const seatsRelations = relations(seatsTable, ({ one }) => ({
    venue: one(venuesTable, {
        fields: [seatsTable.venue_id],
        references: [venuesTable.id],
    }),
    venueMatch: one(venueMatchesTable, {
        fields: [seatsTable.venue_match_id],
        references: [venueMatchesTable.id],
    }),
}));

// ... existing relations ...

export const tablesRelations = relations(tablesTable, ({ one, many }) => ({
    venue: one(venuesTable, {
        fields: [tablesTable.venue_id],
        references: [venuesTable.id],
    }),
    reservations: many(reservationsTable),
    holds: many(tableHoldsTable),
}));

export const tableHoldsRelations = relations(tableHoldsTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [tableHoldsTable.user_id],
        references: [usersTable.id],
    }),
    table: one(tablesTable, {
        fields: [tableHoldsTable.table_id],
        references: [tablesTable.id],
    }),
    venueMatch: one(venueMatchesTable, {
        fields: [tableHoldsTable.venue_match_id],
        references: [venueMatchesTable.id],
    }),
}));

// Update reservationsRelations
export const reservationsRelations = relations(reservationsTable, ({ one, many }) => ({
    user: one(usersTable, {
        fields: [reservationsTable.user_id],
        references: [usersTable.id],
    }),
    venueMatch: one(venueMatchesTable, {
        fields: [reservationsTable.venue_match_id],
        references: [venueMatchesTable.id],
    }),
    table: one(tablesTable, {
        fields: [reservationsTable.table_id],
        references: [tablesTable.id],
    }),
    transactions: many(transactionsTable),
}));

export const reviewsRelations = relations(reviewsTable, ({ one, many }) => ({
    user: one(usersTable, {
        fields: [reviewsTable.user_id],
        references: [usersTable.id],
    }),
    venue: one(venuesTable, {
        fields: [reviewsTable.venue_id],
        references: [venuesTable.id],
    }),
    helpfulVotes: many(reviewHelpfulTable),
}));

export const reviewHelpfulRelations = relations(reviewHelpfulTable, ({ one }) => ({
    review: one(reviewsTable, {
        fields: [reviewHelpfulTable.review_id],
        references: [reviewsTable.id],
    }),
    user: one(usersTable, {
        fields: [reviewHelpfulTable.user_id],
        references: [usersTable.id],
    }),
}));

export const notificationsRelations = relations(notificationsTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [notificationsTable.user_id],
        references: [usersTable.id],
    }),
}));

export const conversationsRelations = relations(conversationsTable, ({ one, many }) => ({
    participant1: one(usersTable, {
        fields: [conversationsTable.participant_1_id],
        references: [usersTable.id],
    }),
    participant2: one(usersTable, {
        fields: [conversationsTable.participant_2_id],
        references: [usersTable.id],
    }),
    messages: many(messagesTable),
}));

export const messagesRelations = relations(messagesTable, ({ one }) => ({
    conversation: one(conversationsTable, {
        fields: [messagesTable.conversation_id],
        references: [conversationsTable.id],
    }),
    sender: one(usersTable, {
        fields: [messagesTable.sender_id],
        references: [usersTable.id],
    }),
}));

export const paymentMethodsRelations = relations(paymentMethodsTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [paymentMethodsTable.user_id],
        references: [usersTable.id],
    }),
}));

export const invoicesRelations = relations(invoicesTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [invoicesTable.user_id],
        references: [usersTable.id],
    }),
}));

// Transactions are for venue owner subscriptions only - users don't pay for reservations
export const transactionsRelations = relations(transactionsTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [transactionsTable.user_id],
        references: [usersTable.id],
    }),
    subscription: one(subscriptionsTable, {
        fields: [transactionsTable.subscription_id],
        references: [subscriptionsTable.id],
    }),
    invoice: one(invoicesTable, {
        fields: [transactionsTable.invoice_id],
        references: [invoicesTable.id],
    }),
    paymentMethod: one(paymentMethodsTable, {
        fields: [transactionsTable.payment_method_id],
        references: [paymentMethodsTable.id],
    }),
}));

export const analyticsRelations = relations(analyticsTable, ({ one }) => ({
    venue: one(venuesTable, {
        fields: [analyticsTable.venue_id],
        references: [venuesTable.id],
    }),
    user: one(usersTable, {
        fields: [analyticsTable.user_id],
        references: [usersTable.id],
    }),
}));

export const auditLogsRelations = relations(auditLogsTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [auditLogsTable.user_id],
        references: [usersTable.id],
    }),
}));

export const bannedUsersRelations = relations(bannedUsersTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [bannedUsersTable.user_id],
        references: [usersTable.id],
    }),
}));

// ============================================
// WAITLIST RELATIONS
// ============================================

export const waitlistRelations = relations(waitlistTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [waitlistTable.user_id],
        references: [usersTable.id],
    }),
    venueMatch: one(venueMatchesTable, {
        fields: [waitlistTable.venue_match_id],
        references: [venueMatchesTable.id],
    }),
}));

// ============================================
// REFERRAL RELATIONS
// ============================================

export const referralCodesRelations = relations(referralCodesTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [referralCodesTable.user_id],
        references: [usersTable.id],
    }),
}));

export const referralsRelations = relations(referralsTable, ({ one }) => ({
    referrer: one(usersTable, {
        fields: [referralsTable.referrer_id],
        references: [usersTable.id],
        relationName: 'referrer',
    }),
    referredUser: one(usersTable, {
        fields: [referralsTable.referred_user_id],
        references: [usersTable.id],
        relationName: 'referredUser',
    }),
}));

export const referralStatsRelations = relations(referralStatsTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [referralStatsTable.user_id],
        references: [usersTable.id],
    }),
}));

export const boostsRelations = relations(boostsTable, ({ one }) => ({
    user: one(usersTable, {
        fields: [boostsTable.user_id],
        references: [usersTable.id],
    }),
    venueMatch: one(venueMatchesTable, {
        fields: [boostsTable.venue_match_id],
        references: [venueMatchesTable.id],
    }),
    purchase: one(boostPurchasesTable, {
        fields: [boostsTable.purchase_id],
        references: [boostPurchasesTable.id],
    }),
    referral: one(referralsTable, {
        fields: [boostsTable.referral_id],
        references: [referralsTable.id],
    }),
}));

export const boostPurchasesRelations = relations(boostPurchasesTable, ({ one, many }) => ({
    user: one(usersTable, {
        fields: [boostPurchasesTable.user_id],
        references: [usersTable.id],
    }),
    boosts: many(boostsTable),
}));

export const boostAnalyticsRelations = relations(boostAnalyticsTable, ({ one }) => ({
    boost: one(boostsTable, {
        fields: [boostAnalyticsTable.boost_id],
        references: [boostsTable.id],
    }),
    venueMatch: one(venueMatchesTable, {
        fields: [boostAnalyticsTable.venue_match_id],
        references: [venueMatchesTable.id],
    }),
    user: one(usersTable, {
        fields: [boostAnalyticsTable.user_id],
        references: [usersTable.id],
    }),
}));
