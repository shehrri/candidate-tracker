import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import writeXlsxFile from "write-excel-file/universal";
import { readImport, candidateWorkbook } from "../src/io";

describe("spreadsheet compatibility", () => {
  it("exports Unicode, leading zeroes and formula-like text as literal strings", async () => {
    const blob = await candidateWorkbook([
      { id: "one", firstName: "Zoë", phone: "001234", notes: "=1+1" },
    ]);
    const bytes = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(bytes);
    expect(
      await zip.file("xl/worksheets/sheet1.xml")!.async("string"),
    ).not.toMatch(/<f[ >]/);
    const records = await readImport(new File([bytes], "candidates.xlsx"));
    expect(records[0]).toMatchObject({
      firstName: "Zoë",
      phone: "001234",
      notes: "'=1+1",
    });
  });
  it("imports dates and numbers and ignores empty rows", async () => {
    const blob = await writeXlsxFile([
      ["firstName", "applicationDate", "experience"],
      [
        "Ada",
        {
          value: new Date("2026-11-05T00:00:00Z"),
          type: Date,
          format: "yyyy-mm-dd",
        },
        5,
      ],
      [null, null, null],
      ["Grace", null, 0],
    ]).toBlob();
    expect(await readImport(new File([blob], "import.xlsx"))).toEqual([
      { firstName: "Ada", applicationDate: "2026-11-05", experience: "5" },
      { firstName: "Grace", applicationDate: "", experience: "0" },
    ]);
  });
  it("exports an empty workbook with headers and rejects malformed XLSX", async () => {
    expect(
      await readImport(new File([await candidateWorkbook([])], "empty.xlsx")),
    ).toEqual([]);
    await expect(
      readImport(new File(["not a workbook"], "bad.xlsx")),
    ).rejects.toThrow();
  });
});
