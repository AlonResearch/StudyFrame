export interface OpenedSourceMaterial {
  readonly id: string;
  readonly file: File;
  readonly relativePath: string;
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

interface DroppedFileEntry {
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  readonly name: string;
  file: (callback: (file: File) => void, onError?: (error: unknown) => void) => void;
  createReader: () => {
    readEntries: (
      callback: (entries: readonly DroppedFileEntry[]) => void,
      onError?: (error: unknown) => void,
    ) => void;
  };
}

function readEntryFile(entry: DroppedFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readDirectoryEntries(entry: DroppedFileEntry): Promise<readonly DroppedFileEntry[]> {
  const reader = entry.createReader();
  const entries: DroppedFileEntry[] = [];
  return new Promise((resolve, reject) => {
    const readNext = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(entries);
          return;
        }
        entries.push(...batch);
        readNext();
      }, reject);
    };
    readNext();
  });
}

async function collectEntryFiles(
  entry: DroppedFileEntry,
  parentPath: string,
): Promise<readonly File[]> {
  if (entry.isFile) {
    const file = await readEntryFile(entry);
    Object.defineProperty(file, "webkitRelativePath", {
      configurable: true,
      value: [parentPath, file.name].filter(Boolean).join("/"),
    });
    return [file];
  }
  if (!entry.isDirectory) return [];
  const directoryPath = [parentPath, entry.name].filter(Boolean).join("/");
  const children = await readDirectoryEntries(entry);
  return (
    await Promise.all(children.map((child) => collectEntryFiles(child, directoryPath)))
  ).flat();
}

export async function filesFromDrop(dataTransfer: DataTransfer): Promise<readonly File[]> {
  const entries = Array.from(dataTransfer.items)
    .map((item) => item.webkitGetAsEntry?.() as DroppedFileEntry | null | undefined)
    .filter((entry): entry is DroppedFileEntry => Boolean(entry));
  if (entries.length === 0) return Array.from(dataTransfer.files);
  return (await Promise.all(entries.map((entry) => collectEntryFiles(entry, "")))).flat();
}

export function makeOpenedSourceMaterials(files: readonly File[]): readonly OpenedSourceMaterial[] {
  return files.map((file, index) => ({
    id: `${index}:${file.webkitRelativePath || file.name}:${file.size}`,
    file,
    relativePath: file.webkitRelativePath || file.name,
    name: file.name || "source material",
    size: file.size,
    type: file.type,
  }));
}

export function openedSourceRootName(materials: readonly OpenedSourceMaterial[]): string {
  const firstPath = materials[0]?.relativePath;
  return firstPath?.includes("/") ? firstPath.split("/")[0]! : "Selected materials";
}
