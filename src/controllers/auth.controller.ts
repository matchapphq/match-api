import { createFactory } from "hono/factory";
import { validator } from "hono/validator";
import { RegisterRequestSchema } from "../utils/auth.valid";
import type { userRegisterData } from "../utils/userData";
import UserRepository from "../repository/user.repository";

class AuthController {
    private readonly factory = createFactory();
    private readonly userRepository = new UserRepository();

    readonly register = this.factory.createHandlers(validator("json", (value, ctx) => {
        const parsed = RegisterRequestSchema.safeParse(value);
        if (!parsed.success) {
            return ctx.json({error: "Invalid request body", details: parsed.error})
        }
        return parsed.data;
    }), async (ctx) => {
        const body = ctx.req.valid("json");
        if (!body) {
            return ctx.json({ msg: "Invalid Request body" }, 401)
        }
        const userRequest: userRegisterData = {
            ...body,
        }
        console.log(userRequest);
        const user = await this.userRepository.createUser(userRequest);
        if (!user) {
            return ctx.json({ msg: "User not created" }, 401)
        }
        return ctx.json({msg: "User created", data: user});
    })
}

export default AuthController;
