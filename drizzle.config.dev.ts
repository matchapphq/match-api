import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config({ path: ".env.dev", override: true});
console.log("Drizzle config loaded");
console.log(process.env.DATABASE_URL);
export default defineConfig({
    out: "./.drizzle/",
    schema: "./src/config/db",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL as string,
    },
    migrations: {
        table: "drizzle_migrations",
        schema: "drizzle"
    },
    extensionsFilters: ["postgis"]
});
