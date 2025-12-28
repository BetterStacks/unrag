import { generateText, type LanguageModel } from "ai";
import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AssetExtractor } from "../../core/types";
import { getAssetBytes } from "../_shared/fetch";
import { capText } from "../_shared/text";

/**
 * Model reference type that accepts both string gateway IDs and LanguageModel instances.
 */
type ModelRef = string | LanguageModel;

const run = async (cmd: string, args: string[], opts: { cwd: string }) => {
  return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      reject(new Error(`${cmd} exited with code ${code}\n${stderr}`.trim()));
    });
  });
};

/**
 * Worker-only frame sampling + per-frame vision extraction.
 *
 * This extractor requires `ffmpeg` and is not suitable for serverless runtimes.
 */
export function createVideoFramesExtractor(): AssetExtractor {
  return {
    name: "video:frames",
    supports: ({ asset, ctx }) =>
      asset.kind === "video" && ctx.assetProcessing.video.frames.enabled,
    extract: async ({ asset, ctx }) => {
      const cfg = ctx.assetProcessing.video.frames;
      const fetchConfig = ctx.assetProcessing.fetch;

      const maxBytes = Math.min(cfg.maxBytes, fetchConfig.maxBytes);
      const { bytes } = await getAssetBytes({
        data: asset.data,
        fetchConfig,
        maxBytes,
        defaultMediaType: "video/mp4",
      });

      const tmpDir = path.join(os.tmpdir(), `unrag-video-frames-${crypto.randomUUID()}`);
      await mkdir(tmpDir, { recursive: true });

      try {
        const videoPath = path.join(tmpDir, "input.mp4");
        await writeFile(videoPath, bytes);

        const ffmpeg = cfg.ffmpegPath ?? "ffmpeg";
        const outPattern = path.join(tmpDir, "frame-%03d.jpg");
        const fps = Math.max(0.001, cfg.sampleFps);
        const maxFrames = Math.max(1, Math.floor(cfg.maxFrames));

        await run(
          ffmpeg,
          [
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            videoPath,
            "-vf",
            `fps=${fps}`,
            "-vframes",
            String(maxFrames),
            outPattern,
          ],
          { cwd: tmpDir }
        );

        const frames = (await readdir(tmpDir))
          .filter((f) => /^frame-\d+\.jpg$/.test(f))
          .sort();

        const abortPerFrame = (ms: number) => AbortSignal.timeout(ms);
        const texts: Array<{ label: string; content: string }> = [];
        let totalChars = 0;

        for (const f of frames) {
          if (texts.length >= maxFrames) break;
          if (totalChars >= cfg.maxOutputChars) break;

          const imgBytes = await readFile(path.join(tmpDir, f));
          const result = await generateText({
            model: cfg.model as ModelRef,
            abortSignal: abortPerFrame(cfg.timeoutMs),
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: cfg.prompt },
                  { type: "image", image: new Uint8Array(imgBytes), mediaType: "image/jpeg" },
                ],
              },
            ],
          });

          const t = (result.text ?? "").trim();
          if (!t) continue;

          const capped = capText(t, cfg.maxOutputChars - totalChars);
          if (!capped) continue;

          texts.push({ label: f, content: capped });
          totalChars += capped.length;
        }

        if (texts.length === 0) return { texts: [] };

        return {
          texts: texts.map((t) => ({ label: t.label, content: t.content })),
          diagnostics: { model: cfg.model },
        };
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    },
  };
}


