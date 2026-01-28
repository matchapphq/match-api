import { defineConfig } from 'drizzle-kit';

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
