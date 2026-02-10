import { createFactory } from "hono/factory";
import { CouponsLogic } from "./coupons.logic";

/**
 * Controller for Coupons operations.
 */
class CouponsController {
    private readonly factory = createFactory();

    constructor(private readonly couponsLogic: CouponsLogic) {}

    readonly validateCoupon = this.factory.createHandlers(async (ctx) => {
        const result = await this.couponsLogic.validateCoupon();
        return ctx.json(result);
    });
}

export default CouponsController;