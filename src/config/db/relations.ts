import { relations } from 'drizzle-orm';
import { users, userPreferences } from './user.table';
import { userAddresses } from './user-addresses.table';
import { userFavoriteVenues } from './user-favorites.table';
import { subscriptions } from './subscriptions.table';
import { venues } from './venues.table';
import { venuePhotos } from './venue-photos.table';
import { sports, leagues, teams } from './sports.table';
import { matches, venueMatches } from './matches.table';
import { seats, seatHolds } from './seats.table';
import { reservations } from './reservations.table';
import { reviews, reviewHelpful } from './reviews.table';
import { notifications, conversations, messages } from './notifications.table';
import { paymentMethods, invoices, transactions } from './billing.table';
import { analytics, auditLogs, bannedUsers } from './admin.table';

export const usersRelations = relations(users, ({ one, many }) => ({
    preferences: one(userPreferences, {
        fields: [users.id],
        references: [userPreferences.user_id],
    }),
    addresses: many(userAddresses),
    favorites: many(userFavoriteVenues),
    subscriptions: many(subscriptions),
    venues: many(venues), // Owned venues
    reservations: many(reservations),
    notifications: many(notifications),
    paymentMethods: many(paymentMethods),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
    user: one(users, {
        fields: [userPreferences.user_id],
        references: [users.id],
    }),
}));

export const userAddressesRelations = relations(userAddresses, ({ one }) => ({
    user: one(users, {
        fields: [userAddresses.user_id],
        references: [users.id],
    }),
}));

export const userFavoriteVenuesRelations = relations(userFavoriteVenues, ({ one }) => ({
    user: one(users, {
        fields: [userFavoriteVenues.user_id],
        references: [users.id],
    }),
    venue: one(venues, {
        fields: [userFavoriteVenues.venue_id],
        references: [venues.id],
    }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
    user: one(users, {
        fields: [subscriptions.user_id],
        references: [users.id],
    }),
    venues: many(venues),
}));

export const venuesRelations = relations(venues, ({ one, many }) => ({
    owner: one(users, {
        fields: [venues.owner_id],
        references: [users.id],
    }),
    subscription: one(subscriptions, {
        fields: [venues.subscription_id],
        references: [subscriptions.id],
    }),
    photos: many(venuePhotos),
    venueMatches: many(venueMatches),
    reviews: many(reviews),
}));

export const venuePhotosRelations = relations(venuePhotos, ({ one }) => ({
    venue: one(venues, {
        fields: [venuePhotos.venue_id],
        references: [venues.id],
    }),
}));

export const sportsRelations = relations(sports, ({ many }) => ({
    leagues: many(leagues),
}));

export const leaguesRelations = relations(leagues, ({ one, many }) => ({
    sport: one(sports, {
        fields: [leagues.sport_id],
        references: [sports.id],
    }),
    teams: many(teams),
}));

export const teamsRelations = relations(teams, ({ one }) => ({
    league: one(leagues, {
        fields: [teams.league_id],
        references: [leagues.id],
    }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
    league: one(leagues, {
        fields: [matches.league_id],
        references: [leagues.id],
    }),
    homeTeam: one(teams, {
        fields: [matches.home_team_id],
        references: [teams.id],
    }),
    awayTeam: one(teams, {
        fields: [matches.away_team_id],
        references: [teams.id],
    }),
    venueMatches: many(venueMatches),
}));

export const venueMatchesRelations = relations(venueMatches, ({ one, many }) => ({
    venue: one(venues, {
        fields: [venueMatches.venue_id],
        references: [venues.id],
    }),
    match: one(matches, {
        fields: [venueMatches.match_id],
        references: [matches.id],
    }),
    reservations: many(reservations),
    seatHolds: many(seatHolds),
}));

export const seatHoldsRelations = relations(seatHolds, ({ one }) => ({
    user: one(users, {
        fields: [seatHolds.user_id],
        references: [users.id],
    }),
    venueMatch: one(venueMatches, {
        fields: [seatHolds.venue_match_id],
        references: [venueMatches.id],
    }),
}));

export const seatsRelations = relations(seats, ({ one }) => ({
    venue: one(venues, {
        fields: [seats.venue_id],
        references: [venues.id],
    }),
    venueMatch: one(venueMatches, {
        fields: [seats.venue_match_id],
        references: [venueMatches.id],
    }),
}));

export const reservationsRelations = relations(reservations, ({ one, many }) => ({
    user: one(users, {
        fields: [reservations.user_id],
        references: [users.id],
    }),
    venueMatch: one(venueMatches, {
        fields: [reservations.venue_match_id],
        references: [venueMatches.id],
    }),
    transactions: many(transactions),
}));

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
    user: one(users, {
        fields: [reviews.user_id],
        references: [users.id],
    }),
    venue: one(venues, {
        fields: [reviews.venue_id],
        references: [venues.id],
    }),
    helpfulVotes: many(reviewHelpful),
}));

export const reviewHelpfulRelations = relations(reviewHelpful, ({ one }) => ({
    review: one(reviews, {
        fields: [reviewHelpful.review_id],
        references: [reviews.id],
    }),
    user: one(users, {
        fields: [reviewHelpful.user_id],
        references: [users.id],
    }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, {
        fields: [notifications.user_id],
        references: [users.id],
    }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
    participant1: one(users, {
        fields: [conversations.participant_1_id],
        references: [users.id],
    }),
    participant2: one(users, {
        fields: [conversations.participant_2_id],
        references: [users.id],
    }),
    messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
    conversation: one(conversations, {
        fields: [messages.conversation_id],
        references: [conversations.id],
    }),
    sender: one(users, {
        fields: [messages.sender_id],
        references: [users.id],
    }),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({ one }) => ({
    user: one(users, {
        fields: [paymentMethods.user_id],
        references: [users.id],
    }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
    user: one(users, {
        fields: [invoices.user_id],
        references: [users.id],
    }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
    user: one(users, {
        fields: [transactions.user_id],
        references: [users.id],
    }),
    reservation: one(reservations, {
        fields: [transactions.reservation_id],
        references: [reservations.id],
    }),
    subscription: one(subscriptions, {
        fields: [transactions.subscription_id],
        references: [subscriptions.id],
    }),
    invoice: one(invoices, {
        fields: [transactions.invoice_id],
        references: [invoices.id],
    }),
    paymentMethod: one(paymentMethods, {
        fields: [transactions.payment_method_id],
        references: [paymentMethods.id],
    }),
}));

export const analyticsRelations = relations(analytics, ({ one }) => ({
    venue: one(venues, {
        fields: [analytics.venue_id],
        references: [venues.id],
    }),
    user: one(users, {
        fields: [analytics.user_id],
        references: [users.id],
    }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
    user: one(users, {
        fields: [auditLogs.user_id],
        references: [users.id],
    }),
}));

export const bannedUsersRelations = relations(bannedUsers, ({ one }) => ({
    user: one(users, {
        fields: [bannedUsers.user_id],
        references: [users.id],
    }),
}));
