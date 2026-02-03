import { readdir, rename } from "fs/promises";
import { extname, join } from "path";

async function renameCjsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await renameCjsFiles(fullPath);
        return;
      }
      if (extname(entry.name) !== ".js") return;
      const nextPath = fullPath.replace(/\.js$/, ".cjs");
      await rename(fullPath, nextPath);
    })
  );
}

await renameCjsFiles(new URL("../dist/cjs", import.meta.url).pathname);
