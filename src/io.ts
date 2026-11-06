import Papa from "papaparse";
import type { Row } from "./model";
export function download(
  name: string,
  data: Blob | string,
  type = "text/plain",
) {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export const candidateColumns = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "city",
  "state",
  "country",
  "title",
  "employer",
  "experience",
  "skills",
  "additionalSkills",
  "education",
  "certifications",
  "source",
  "owner",
  "applicationDate",
  "status",
  "currentCompensation",
  "desiredCompensation",
  "authorization",
  "relocation",
  "workPreference",
  "availability",
  "notes",
  "tags",
  "linkedin",
  "website",
];
export async function readImport(
  file: File,
): Promise<Record<string, string>[]> {
  if (file.size > 20 * 1024 * 1024)
    throw Error("Import files must be under 20 MB.");
  if (/\.csv$/i.test(file.name)) {
    const result = Papa.parse<Record<string, string>>(await file.text(), {
      header: true,
      skipEmptyLines: "greedy",
    });
    if (result.errors.length)
      throw Error(
        result.errors.map((e) => `Row ${e.row}: ${e.message}`).join("\n"),
      );
    return result.data;
  }
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/universal");
    const data = await readSheet(await file.arrayBuffer());
    const text = (value: unknown): string =>
      value instanceof Date
        ? value.toISOString().slice(0, 10)
        : String(value ?? "");
    const headers = (data[0] ?? []).map(text);
    return data
      .slice(1)
      .filter((row) => row.some((value) => value !== null && value !== ""))
      .map((row) =>
        Object.fromEntries(
          headers.flatMap((header, index) =>
            header ? [[header, text(row[index])]] : [],
          ),
        ),
      );
  }
  throw Error("Use CSV or XLSX.");
}
const safeCell = (s: unknown) => {
  const v = String(s ?? "");
  return /^[\s]*[=+@\-]/.test(v) ? `'${v}` : v;
};
export async function exportCandidates(rows: Row[], format: "csv" | "xlsx") {
  const columns = ["id", ...candidateColumns, "createdAt", "updatedAt"];
  const records = rows.map((r) =>
    Object.fromEntries(columns.map((k) => [k, safeCell(r[k])])),
  );
  if (format === "csv")
    download(
      "candidates.csv",
      Papa.unparse(records, { columns }),
      "text/csv;charset=utf-8",
    );
  else {
    download("candidates.xlsx", await candidateWorkbook(rows));
  }
}

export async function candidateWorkbook(rows: Row[]): Promise<Blob> {
  const { default: writeXlsxFile } = await import("write-excel-file/universal");
  const columns = ["id", ...candidateColumns, "createdAt", "updatedAt"];
  return writeXlsxFile(
    [
      columns.map((value) => ({
        value,
        type: String,
        fontWeight: "bold" as const,
      })),
      ...rows.map((row) =>
        columns.map((key) => ({ value: safeCell(row[key]), type: String })),
      ),
    ],
    { sheet: "Candidates", columns: columns.map(() => ({ width: 22 })) },
  ).toBlob();
}
