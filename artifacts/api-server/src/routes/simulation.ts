import { Router, type Request, type Response } from "express";
import multer from "multer";
import { simulationController } from "../simulation/simulationController";
import { parseTelemetryBuffer } from "../simulation/telemetryParser";
import { logger } from "../lib/logger";

const router = Router();

// Memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max
  },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith(".xlsx") || ext.endsWith(".xls") || ext.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Please upload an .xlsx or .csv dataset."));
    }
  },
});

/**
 * Shared file parsing handler
 */
async function handleUploadedDataset(req: Request, res: Response) {
  try {
    const uploadedFile =
      req.file ||
      (Array.isArray(req.files) && req.files.length > 0 ? req.files[0] : null);

    if (!uploadedFile || !uploadedFile.buffer) {
      res.status(400).json({
        success: false,
        error: "No file uploaded. Please upload an .xlsx or .csv dataset file.",
      });
      return;
    }

    const points = parseTelemetryBuffer(uploadedFile.buffer);
    if (!points || points.length === 0) {
      res.status(400).json({
        success: false,
        error: "The uploaded file contains no valid telemetry records.",
      });
      return;
    }

    const requestedShipmentId = typeof req.body?.shipmentId === "string"
      ? req.body.shipmentId.trim()
      : simulationController.activeShipmentId;
    if (!requestedShipmentId || requestedShipmentId.length > 64) {
      res.status(400).json({
        success: false,
        error: "shipmentId must be a non-empty string of at most 64 characters.",
      });
      return;
    }
    const persisted = await simulationController.loadUploadedDataset(points, requestedShipmentId);

    // Return Step 2 required shape: { success: true, totalRecords: number, preview: record[0] }
    res.json({
      success: true,
      totalRecords: points.length,
      preview: points[0],
      filename: uploadedFile.originalname,
      storage: persisted ? "postgres" : "memory",
      status: simulationController.getStatus(),
    });
  } catch (err: any) {
    logger.error({ err }, "Error processing simulation dataset upload");
    res.status(400).json({
      success: false,
      error: "Failed to parse dataset",
      details: err?.message || String(err),
    });
  }
}

/**
 * POST /api/dataset/upload
 * Primary endpoint for customer dataset uploads (Step 2)
 */
router.post("/dataset/upload", upload.any(), async (req: Request, res: Response) => {
  await handleUploadedDataset(req, res);
});

/**
 * POST /api/simulation/upload
 * Backward compatible endpoint
 */
router.post("/simulation/upload", upload.any(), async (req: Request, res: Response) => {
  await handleUploadedDataset(req, res);
});

/**
 * POST /api/simulation/load-local
 * Loads the local dataset from ./data/sample_coldchain.xlsx or ./data/simulation_dataset.xlsx
 */
router.post("/simulation/load-local", (req: Request, res: Response) => {
  try {
    const customPath = req.body?.filePath as string | undefined;
    const totalRecords = simulationController.loadLocalDataset(customPath);

    res.json({
      success: true,
      totalRecords,
      preview: simulationController.records[0] ?? null,
      message: `Loaded ${totalRecords} records from local dataset.`,
      status: simulationController.getStatus(),
    });
  } catch (err: any) {
    logger.error({ err }, "Error loading local simulation dataset");
    res.status(400).json({
      success: false,
      error: "Failed to load local dataset",
      details: err?.message || String(err),
    });
  }
});

/**
 * POST /api/simulation/play
 * Starts sequential auto-play loop (Step 3)
 */
router.post("/simulation/play", (req: Request, res: Response) => {
  try {
    const intervalMs = req.body?.intervalMs ? Number(req.body.intervalMs) : undefined;
    const speed = req.body?.speed ? Number(req.body.speed) : undefined;

    const status = simulationController.play({ intervalMs, speed });
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || "Failed to play simulation" });
  }
});

/**
 * POST /api/simulation/start
 * Backward compatible start route
 */
router.post("/simulation/start", (req: Request, res: Response) => {
  try {
    const intervalMs = req.body?.intervalMs ? Number(req.body.intervalMs) : undefined;
    const speed = req.body?.speed ? Number(req.body.speed) : undefined;

    const status = simulationController.play({ intervalMs, speed });
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || "Failed to start simulation" });
  }
});

/**
 * POST /api/simulation/pause
 * Pauses playback at the current index (Step 3)
 */
router.post("/simulation/pause", (_req: Request, res: Response) => {
  try {
    const status = simulationController.pause();
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || "Failed to pause simulation" });
  }
});

/**
 * POST /api/simulation/step
 * Emits row at currentIndex and advances by 1 (Step 3)
 */
router.post("/simulation/step", async (_req: Request, res: Response) => {
  try {
    const result = await simulationController.step();
    res.json({
      success: true,
      status: result.status,
      record: result.record,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || "Failed to advance step" });
  }
});

/**
 * POST /api/simulation/reset
 * Sets currentIndex = 0 and halts timer (Step 3)
 */
router.post("/simulation/reset", (_req: Request, res: Response) => {
  try {
    const status = simulationController.reset();
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || "Failed to reset simulation" });
  }
});

/**
 * POST /api/simulation/speed
 * Updates intervalMs dynamically (Step 3)
 */
router.post("/simulation/speed", (req: Request, res: Response) => {
  try {
    const intervalMs = req.body?.intervalMs ? Number(req.body.intervalMs) : undefined;
    const speed = req.body?.speed ? Number(req.body.speed) : undefined;

    const status = simulationController.setSpeed({ intervalMs, speed });
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || "Failed to update speed" });
  }
});

/**
 * GET /api/simulation/status
 * Returns current playback state (currentIndex, totalRecords, isPlaying, intervalMs)
 */
router.get("/simulation/status", (_req: Request, res: Response) => {
  const status = simulationController.getStatus();
  res.json(status);
});

/**
 * GET /api/simulation/stream
 * Real-time Server-Sent Events (SSE) broadcast for step telemetry & alerts (Step 3)
 */
router.get("/simulation/stream", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  simulationController.addClient(res);

  // Periodic heartbeat comment to keep connection alive
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch (_) {
      clearInterval(heartbeatTimer);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeatTimer);
    simulationController.removeClient(res);
  });
});

export default router;
