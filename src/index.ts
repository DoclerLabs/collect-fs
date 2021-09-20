import { promises, constants, existsSync, mkdirSync, rmSync } from "fs";
import { join, dirname, relative } from "path";

import chokidar from "chokidar";

const tree = async (
  root: string,
  base = "",
  fileMap: Record<string, string> = {}
) => {
  const dir = join(root, base);
  const contents = await promises.readdir(dir);
  const recursivePromises: Promise<void>[] = [];
  await Promise.all(
    contents.map(async (content): Promise<void> => {
      const path = join(dir, content);
      const rel = join(base, content);
      const stats = await promises.stat(path);
      if (stats.isFile()) {
        // eslint-disable-next-line no-param-reassign
        fileMap[rel] = path;
        return undefined;
      }
      if (stats.isDirectory()) {
        recursivePromises.push(
          // weird false positive
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          tree(root, rel, fileMap).then(() => {
            return undefined;
          })
        );
      }
      return undefined;
    })
  );
  await Promise.all(recursivePromises);
  return fileMap;
};

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

export const mergeDirectories = async (
  sources: string[],
  destination: string
): Promise<void> => {
  await ensureDir(destination);

  const trees = await Promise.all(
    sources.map((source) => {
      return tree(source);
    })
  );
  const matches: Record<string, string> = trees.reduce((acc, next) => {
    return { ...acc, ...next };
  }, {});

  await Promise.all(
    Object.entries(matches).map(async ([rel, absolute]) => {
      const ss = join(destination, rel);
      await ensureDir(dirname(ss));
      return promises.copyFile(absolute, ss);
    })
  );
};

type EventData = {
  type: "add" | "change" | "unlink",
  data: Record<string, unknown>
}

export default function collectFs(
  sources: string[],
  destination: string,
  onEvent?: (eventData: EventData) => void,
): void {
  if (!existsSync(destination)) {
    mkdirSync(destination);
  }

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

    const handleFileUpdate = async (path: string, eventType: "add" | "change") => {
      const rel = relative(base, path);
      updateFile(rel);
      if (shouldBail(rel)) {
        return;
      }
      const target = join(destination, rel);
      await ensureDir(dirname(target));
      await promises.copyFile(path, target, constants.COPYFILE_FICLONE);

      if (onEvent) {
        onEvent({ type: eventType, data: { path, rel, target } })
      }
      if (process.send) {
        process.send({ type: eventType, data: { path, rel, target }})
      }

    };

    watcher.on("add", (path) => handleFileUpdate(path, "add"));

    watcher.on("change", (path) => handleFileUpdate(path, "change"));

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

      if (onEvent) {
        onEvent({ type: "unlink", data: { path, rel, target } })
      }
      if (process.send) {
        process.send({ type: "unlink", data: { path, rel, target }})
      }

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
