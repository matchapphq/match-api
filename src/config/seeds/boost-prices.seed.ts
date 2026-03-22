/**
 * Seed script for Boost Prices
 * Populates the boost_prices table with pricing data for boost packs.
 * 
 * Run with: bun run src/config/seeds/boost-prices.seed.ts
 */

import { db } from "../config.db";
import { boostPricesTable } from "../db/boost.table";

async function seedBoostPrices() {
    console.log("🚀 Seeding boost prices...");

    const prices = [
        {
            pack_type: 'single',
            quantity: 1,
            price: '30.00',
            unit_price: '30.00',
            discount_percentage: 0,
            active: true,
        },
        {
            pack_type: 'pack_3',
            quantity: 3,
            price: '75.00',
            unit_price: '25.00',
            discount_percentage: 17,
            active: true,
        },
        {
            pack_type: 'pack_10',
            quantity: 10,
            price: '200.00',
            unit_price: '20.00',
            discount_percentage: 33,
            active: true,
        },
    ];

    try {
        for (const price of prices) {
            await db.insert(boostPricesTable)
                .values(price)
                .onConflictDoUpdate({
                    target: boostPricesTable.pack_type,
                    set: {
                        quantity: price.quantity,
                        price: price.price,
                        unit_price: price.unit_price,
                        discount_percentage: price.discount_percentage,
                        active: price.active,
                    },
                });
            console.log(`  ✅ Created/Updated pack: ${price.pack_type}`);
        }

        console.log("\n✅ Boost prices seeded successfully!");
        console.log(`   - single: 1 boost for €30`);
        console.log(`   - pack_3: 3 boosts for €75 (17% off)`);
        console.log(`   - pack_10: 10 boosts for €200 (33% off)`);
    } catch (error) {
        console.error("❌ Error seeding boost prices:", error);
        throw error;
    }
}

// Run if executed directly
seedBoostPrices()
    .then(() => {
        console.log("\n🎉 Done!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Failed to seed boost prices:", error);
        process.exit(1);
    });

export { seedBoostPrices };
