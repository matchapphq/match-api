import { Hono } from "hono";
import { SupportController } from "./support.controller";
import { SupportLogic } from "./support.logic";

export default class SupportService {
  public readonly router: Hono;
  private readonly controller: SupportController;
  private readonly logic: SupportLogic;

  constructor() {
    this.router = new Hono();
    this.logic = new SupportLogic();
    this.controller = new SupportController(this.logic);
    this.initRoutes();
  }

  private initRoutes() {
    this.router.post("/bug-report", (c) => this.controller.reportBug(c));
  }

  get getRouter() {
    return this.router;
  }
}
