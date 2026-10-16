import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const root = path.join(process.cwd(), "storage");

function safeKey(key: string) {
  if (!key || key.includes("..") || path.isAbsolute(key)) {
    throw new Error("Invalid storage key");
  }
  return key;
}

export async function saveFile(key: string, bytes: Buffer) {
  const relative = safeKey(key);
  const full = path.join(root, relative);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
}

export async function readStoredFile(key: string) {
  const full = path.join(root, safeKey(key));
  return readFile(full);
}
