import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    out: "./.drizzle/",
    schema: "./src/config/db",
    dialect: "postgresql",
    dbCredentials: {
        user: "postgres",
        password: "postgres",
        host: "localhost",
        port: 5432,
        database: "match",
    },
    extensionsFilters: ["postgis"]
});
