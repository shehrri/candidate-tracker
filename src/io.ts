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
    const Excel = await import("exceljs");
    const book = new Excel.Workbook();
    await book.xlsx.load(await file.arrayBuffer());
    const sheet = book.worksheets[0];
    if (!sheet) throw Error("No worksheet found.");
    const headers: string[] = [];
    sheet.getRow(1).eachCell((c, i) => (headers[i] = c.text));
    const rows: Record<string, string>[] = [];
    sheet.eachRow((row, n) => {
      if (n === 1) return;
      const r: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (h) r[h] = row.getCell(i).text;
      });
      rows.push(r);
    });
    return rows;
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
    const Excel = await import("exceljs");
    const book = new Excel.Workbook(),
      sheet = book.addWorksheet("Candidates");
    sheet.columns = columns.map((k) => ({ header: k, key: k, width: 22 }));
    records.forEach((r) => sheet.addRow(r));
    sheet.getRow(1).font = { bold: true };
    const bytes = await book.xlsx.writeBuffer();
    download(
      "candidates.xlsx",
      new Blob([bytes as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
  }
}
