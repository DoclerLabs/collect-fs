import { promises, constants, existsSync, mkdirSync, rmSync } from "fs";
import { join, dirname, relative } from "path";

import chokidar from "chokidar";

export default function collectFs(
  sources: string[],
  destination: string
): void {
  if (!existsSync(destination)) {
    mkdirSync(destination);
  }

  const ensureDir = async (path: string) => {
    try {
      const stat = await promises.stat(path);
      if (stat.isDirectory()) {
        return;
      }
    } catch {
      // ignore the fuck out of this error
    } finally {
      await promises.mkdir(path, { recursive: true });
    }
  };

  const files: Record<string, number[]> = {};

  const last = <Type>(array: Type[]): Type => {
    return array[array.length - 1];
  };

  const sortIncremental = (a: number, b: number): number => {
    return a - b;
  };

  sources.forEach((base, index) => {
    const watcher = chokidar.watch(join(base, "**/*"));

    const shouldBail = (rel: string) => {
      return files[rel] && last(files[rel]) > index;
    };

    const updateFile = (rel: string) => {
      const arr = files[rel];
      if (!arr) {
        files[rel] = [index];
        return;
      }
      if (arr.includes(index)) {
        return;
      }
      arr.push(index);
      arr.sort(sortIncremental);
    };

    const removeFile = (rel: string) => {
      const arr = files[rel];
      if (arr) {
        arr.splice(arr.indexOf(index), 1);
      }
    };

    const getNextFile = (rel: string) => {
      const lastIndex = last(files[rel]);
      if (typeof lastIndex === "undefined") {
        return null;
      }
      return join(sources[lastIndex], rel);
    };

    const handleFileUpdate = async (path: string) => {
      const rel = relative(base, path);
      updateFile(rel);
      if (shouldBail(rel)) {
        return;
      }
      const target = join(destination, rel);
      await ensureDir(dirname(target));
      await promises.copyFile(path, target, constants.COPYFILE_FICLONE);
    };

    watcher.on("add", handleFileUpdate);

    watcher.on("change", handleFileUpdate);

    watcher.on("unlink", async (path) => {
      const rel = relative(base, path);
      removeFile(rel);
      if (shouldBail(rel)) {
        return;
      }
      const next = getNextFile(rel);
      const target = join(destination, rel);
      if (next) {
        await ensureDir(dirname(target));
        await promises.copyFile(next, target, constants.COPYFILE_FICLONE);
        return;
      }
      await promises.unlink(target);
    });
  });

  (
    ["exit", "SIGINT", "SIGUSR1", "SIGUSR2", "uncaughtException"] as const
  ).forEach((event) => {
    process.on(event, () => {
      rmSync(destination, { force: true, recursive: true });
      process.exit(0);
    });
  });
}
