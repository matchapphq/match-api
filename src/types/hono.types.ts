import type { TokenPayload } from "../utils/jwt";

export type HonoEnv = {
    Variables: {
        user: TokenPayload;
    }
}
