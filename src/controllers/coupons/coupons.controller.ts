import { createFactory } from "hono/factory";

/**
 * Controller for Coupons operations.
 */
class CouponsController {
    private readonly factory = createFactory();

    readonly validateCoupon = this.factory.createHandlers(async (ctx) => {
        return ctx.json({ msg: "Validate coupon" });
    });
}

export default CouponsController;
