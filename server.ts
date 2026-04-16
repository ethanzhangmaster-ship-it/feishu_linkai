import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";
import cron from "node-cron";
import { runAutoSync } from "./server/syncJob.js";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Proxy Feishu API requests (MUST BE BEFORE express.json())
  app.use(
    "/api/feishu",
    createProxyMiddleware({
      target: "https://open.feishu.cn",
      changeOrigin: true,
      pathRewrite: {
        "^/api/feishu": "", // remove /api/feishu prefix
      },
      on: {
        proxyReq: (proxyReq, req, res) => {
          console.log(`[Feishu Proxy] Requesting: ${proxyReq.method} ${proxyReq.path}`);
        },
        proxyRes: (proxyRes, req, res) => {
          console.log(`[Feishu Proxy] Response: ${proxyRes.statusCode} ${req.url}`);
        },
        error: (err, req, res) => {
          console.error(`[Feishu Proxy] Error:`, err);
        }
      }
    })
  );

  // Proxy Adjust API requests (MUST BE BEFORE express.json())
  app.use(
    "/api/adjust",
    createProxyMiddleware({
      target: "https://automate.adjust.com",
      changeOrigin: true,
      pathRewrite: {
        "^/api/adjust": "",
      },
    })
  );

  app.use(express.json());

  // API to save sync config
  app.post("/api/sync/config", (req, res) => {
    try {
      fs.writeFileSync(
        path.join(process.cwd(), "app-config.json"),
        JSON.stringify(req.body, null, 2)
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // API to get sync config
  app.get("/api/sync/config", (req, res) => {
    try {
      const configPath = path.join(process.cwd(), "app-config.json");
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, "utf-8");
        res.json(JSON.parse(data));
      } else {
        res.json({});
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // API to trigger sync manually
  app.post("/api/sync/trigger", async (req, res) => {
    try {
      // Run in background to prevent HTTP timeout
      runAutoSync(true).then(result => {
        console.log("Manual sync completed:", result);
      }).catch(e => {
        console.error("Manual sync failed:", e);
      });
      
      res.json({ 
        success: true, 
        message: "同步任务已在后台启动，请稍后在飞书表格中查看结果。" 
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Schedule daily sync at 2:00 PM (14:00) Beijing Time
  cron.schedule("0 14 * * *", () => {
    console.log("Running scheduled auto sync at 14:00 (Asia/Shanghai)...");
    
    let attempt = 1;
    const maxAttempts = 3; // Limit to 3 attempts

    const executeSync = async () => {
      try {
        console.log(`Auto sync attempt ${attempt}...`);
        const res = await runAutoSync();
        
        // Check if data was actually synced
        const noData = res.success && res.result?.updated === 0 && res.result?.appended === 0;

        if (noData || !res.success) {
          console.log(`Sync attempt ${attempt} ${!res.success ? 'failed' : 'yielded no data'}.`);
          if (attempt < maxAttempts) {
            attempt++;
            console.log("Waiting 10 minutes before retrying...");
            setTimeout(executeSync, 10 * 60 * 1000); // 10 minutes
          } else {
            console.log("Max sync attempts reached. Giving up for today.");
          }
        } else {
          console.log("Scheduled sync completed successfully with data.");
        }
      } catch (e) {
        console.error("Error in scheduled sync:", e);
        if (attempt < maxAttempts) {
          attempt++;
          console.log("Waiting 10 minutes before retrying...");
          setTimeout(executeSync, 10 * 60 * 1000);
        } else {
          console.log("Max sync attempts reached. Giving up for today.");
        }
      }
    };

    executeSync();
  }, {
    timezone: "Asia/Shanghai"
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
