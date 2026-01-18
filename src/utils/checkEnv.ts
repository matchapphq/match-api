function isEnvsDefined(): boolean {
    return process.env.NODE_ENV !== undefined &&
        process.env.DATABASE_HOST !== undefined &&
        process.env.DATABASE_PORT !== undefined &&
        process.env.DATABASE_USER !== undefined &&
        process.env.DATABASE_PASSWORD !== undefined &&
        process.env.DATABASE_NAME !== undefined &&
        process.env.DATABASE_URL !== undefined &&
        process.env.SECRET_KEY !== undefined &&
        process.env.REFRESH_SECRET_KEY !== undefined &&
        process.env.ACCESS_JWT_SIGN_KEY !== undefined &&
        process.env.REFRESH_JWT_SIGN_KEY !== undefined &&
        process.env.QR_SECRET !== undefined &&
        process.env.STRIPE_SECRET_KEY !== undefined &&
        process.env.STRIPE_PUBLISHABLE_KEY !== undefined &&
        process.env.STRIPE_WEBHOOK_SECRET !== undefined &&
        process.env.STRIPE_PRICE_MONTHLY !== undefined &&
        process.env.STRIPE_PRICE_ANNUAL !== undefined &&
        process.env.FRONTEND_URL !== undefined &&
        process.env.LOCATIONIQ_KEY !== undefined &&
        process.env.PORT !== undefined;
}

export default isEnvsDefined;