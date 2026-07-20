import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import tracksRouter from "./tracks";
import unityRouter from "./unity";
import pathsRouter from "./paths";
import meRouter from "./me";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/catalog", catalogRouter);
router.use("/tracks", tracksRouter);
router.use("/unity", unityRouter);
router.use("/paths", pathsRouter);
router.use("/me", meRouter);
router.use("/admin", adminRouter);

export default router;
