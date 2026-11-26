"""รวม body.html + app.css + engine.js + app.js
- dist/index.html            : ระบบต้นฉบับ ยังไม่นำเข้าข้อมูล
- dist/index_with_data.html  : ระบบที่ฝังข้อมูล Excel แล้ว (ถ้าส่งไฟล์ Excel มา)
ใช้: python build.py [courses.xlsx]
"""
import json, pathlib, sys
d = pathlib.Path(__file__).parent
html = (d / "body.html").read_text(encoding="utf-8")
html = html.replace("/*CSS*/", (d / "app.css").read_text(encoding="utf-8"))
html = html.replace("/*ENGINE*/", (d / "engine.js").read_text(encoding="utf-8"))
(d / "dist").mkdir(exist_ok=True)
sample_js = ""
sp = d / "sample.json"
if sp.exists():
    sample_js = "window.SAMPLE=" + sp.read_text(encoding="utf-8") + ";\n"
app = sample_js + (d / "app.js").read_text(encoding="utf-8").replace("/*FEATURES*/", (d / "features.js").read_text(encoding="utf-8")).replace("/*AUTH*/", (d / "auth.js").read_text(encoding="utf-8"))
(d / "dist" / "index.html").write_text(html.replace("/*APP*/", app), encoding="utf-8")
print("built dist/index.html")

if len(sys.argv) > 1:
    import openpyxl
    src = pathlib.Path(sys.argv[1])
    wb = openpyxl.load_workbook(src, data_only=True)
    sheets = [{"name": ws.title, "rows": [[c if not hasattr(c, "isoformat") else str(c) for c in r]
                                          for r in ws.iter_rows(values_only=True)]} for ws in wb.worksheets]
    embed = "window.EMBED=" + json.dumps({"fileName": src.name, "sheets": sheets}, ensure_ascii=False) + ";\n"
    (d / "dist" / "index_with_data.html").write_text(html.replace("/*APP*/", embed + app), encoding="utf-8")
    print("built dist/index_with_data.html")
