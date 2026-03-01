import { Hono } from "hono";
import { SupportController } from "./support.controller";
import { SupportLogic } from "./support.logic";
import { authMiddleware } from "../../middleware/auth.middleware";
import type { HonoEnv } from "../../types/hono.types";

export default class SupportService {
  public readonly router: Hono<HonoEnv>;
  private readonly controller: SupportController;
  private readonly logic: SupportLogic;

  constructor() {
    this.router = new Hono<HonoEnv>();
    this.logic = new SupportLogic();
    this.controller = new SupportController(this.logic);
    this.initRoutes();
  }

  private initRoutes() {
    this.router.post("/bug-report", (c) => this.controller.reportBug(c));
    this.router.post("/contact-request", authMiddleware, (c) => this.controller.requestSupportContact(c));
    this.router.post("/data-export-request", authMiddleware, (c) => this.controller.requestDataExport(c));
  }

  get getRouter() {
    return this.router;
  }
}
