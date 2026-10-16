import { Router, type IRouter } from "express";
import healthRouter from "./health";
import simulationRouter from "./simulation";
import facilityRouter from "./facility";
import copilotRouter from "./copilot";

const router: IRouter = Router();

router.use(healthRouter);
router.use(simulationRouter);
router.use(facilityRouter);
router.use(copilotRouter);

export default router;
