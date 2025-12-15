import { drizzle } from "drizzle-orm/node-postgres";

const getDatabaseConfig = () => {
    const config = {
        host: process.env.DATABASE_HOST || 'localhost',
        user: process.env.DATABASE_USER || 'postgres',
        password: process.env.DATABASE_PASSWORD || 'postgres',
        database: process.env.DATABASE_NAME || 'postgres',
        port: 5432,
        ssl: { rejectUnauthorized: false },
    };

    if (process.env.NODE_ENV === 'production') {
        if (!process.env.DATABASE_HOST || !process.env.DATABASE_PASSWORD) {
            throw new Error('Database configuration missing required values in production');
        }
    }

    return config;
};

const config = getDatabaseConfig();
const connectionString = `postgres://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;

export const db = drizzle(connectionString);