import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Magic Labs Identity Provider
  app.post("/api/magic/identity-provider", async (req, res) => {
    const magicSecretKey = process.env.MAGIC_SECRET_KEY;
    if (!magicSecretKey) {
      return res.status(500).json({ error: "MAGIC_SECRET_KEY is not configured" });
    }

    const { issuer, audience, jwks_uri } = req.body;

    try {
      const response = await fetch("https://tee.express.magiclabs.com/v1/identity/provider", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Magic-Secret-Key": magicSecretKey,
        },
        body: JSON.stringify({
          issuer: issuer || process.env.MAGIC_ISSUER,
          audience: audience || process.env.MAGIC_AUDIENCE,
          jwks_uri: jwks_uri || process.env.MAGIC_JWKS_URI,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (error) {
      console.error("Error calling Magic Labs API:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
