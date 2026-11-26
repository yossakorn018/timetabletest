"""แปลงไฟล์ Excel รายวิชาเป็น sheets.json ให้ test.js และ check_independent.js อ่าน
ใช้: python dump_sheets.py ../data/ข้อมูลรายวิชา_ver2.xlsx
"""
import json, pathlib, sys
import openpyxl

src = sys.argv[1] if len(sys.argv) > 1 else "../data/ข้อมูลรายวิชา_ver2.xlsx"
wb = openpyxl.load_workbook(src, data_only=True)
sheets = [{"name": ws.title, "rows": [list(r) for r in ws.iter_rows(values_only=True)]} for ws in wb.worksheets]
out = pathlib.Path(__file__).parent / "sheets.json"
out.write_text(json.dumps(sheets, ensure_ascii=False, default=str), encoding="utf-8")
print("wrote", out)
