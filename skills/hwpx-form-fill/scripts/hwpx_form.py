#!/usr/bin/env python3
"""hwpx_form.py - fill Korean HWPX (Hangul) form tables by label, without Hancom Office.

Commands
  inspect <form.hwpx>                       show every table cell (row/col/text) as JSON
  fill <form.hwpx> <values.json> <out.hwpx> fill target cells next to (or below) label cells

values.json
  {
    "성명": "홍길동",                 # target = cell to the RIGHT of the label (default)
    "신청 동기@below": "...",         # target = cell BELOW the label
    "#0:2,1": "..."                   # exact address: table 0, row 2, col 1
  }

Rules the script enforces
  - Only empty cells or guide-text cells (starting with □ ○ ● ※ - * or containing
    "적어", "입력", "기재") are overwritten. A cell that already holds real content is
    reported as "skipped_filled" instead of being overwritten (use --force to override).
  - A label that matches 0 cells is "missing"; a label that matches 2+ cells is
    "ambiguous" and is NOT filled (use the exact #table:row,col address instead).
  - The result is re-opened and validated; exit code 1 if anything was missing,
    ambiguous or skipped, so an agent cannot silently claim success.

Requires: pip install python-hwpx   (https://github.com/airmang/python-hwpx)
"""
import json
import re
import sys
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning)

try:
    from hwpx import HwpxDocument
except ImportError:  # pragma: no cover
    sys.exit("python-hwpx is not installed. Run: pip install python-hwpx")

GUIDE_RE = re.compile(r"^\s*([□○●◎※\-\*·]|\(.*\)$)|적어|입력|기재|작성해")
ADDR_RE = re.compile(r"^#(\d+):(\d+),(\d+)$")


def table_objects(doc):
    tables = doc.tables.all() if callable(getattr(doc.tables, "all", None)) else doc.tables.all
    return list(tables)


def cell_text(table, row, col):
    try:
        return (table.cell(row, col).text or "").strip()
    except Exception:
        return ""


def inspect(path):
    doc = HwpxDocument.open(path)
    out = []
    for ti, t in enumerate(table_objects(doc)):
        cells = []
        for r in range(t.row_count):
            for c in range(t.column_count):
                try:
                    txt = cell_text(t, r, c)
                except Exception:
                    continue
                cells.append({"row": r, "col": c, "text": txt})
        out.append({"table": ti, "rows": t.row_count, "cols": t.column_count, "cells": cells})
    print(json.dumps(out, ensure_ascii=False, indent=1))


def is_fillable(text, force):
    return force or text == "" or bool(GUIDE_RE.search(text))


def find_targets(tables, label, direction):
    hits = []
    want = re.sub(r"\s+", "", label)
    for ti, t in enumerate(tables):
        for r in range(t.row_count):
            for c in range(t.column_count):
                if re.sub(r"\s+", "", cell_text(t, r, c)) != want:
                    continue
                tr, tc = (r, c + 1) if direction == "right" else (r + 1, c)
                if tr < t.row_count and tc < t.column_count:
                    hits.append((ti, tr, tc))
    # merged cells can report the same physical target twice
    return sorted(set(hits))


def fill(src, values_path, dst, force=False):
    with open(values_path, encoding="utf-8") as f:
        values = json.load(f)
    doc = HwpxDocument.open(src)
    tables = table_objects(doc)
    report = {"filled": [], "missing": [], "ambiguous": [], "skipped_filled": []}

    for key, value in values.items():
        m = ADDR_RE.match(key)
        if m:
            targets = [tuple(int(x) for x in m.groups())]
        else:
            label, _, direction = key.partition("@")
            targets = find_targets(tables, label, direction or "right")
        if not targets:
            report["missing"].append(key)
            continue
        if len(targets) > 1:
            report["ambiguous"].append({"key": key, "targets": targets})
            continue
        ti, r, c = targets[0]
        current = cell_text(tables[ti], r, c)
        if not is_fillable(current, force):
            report["skipped_filled"].append({"key": key, "current": current[:40]})
            continue
        tables[ti].set_cell_text(r, c, str(value))
        report["filled"].append({"key": key, "table": ti, "row": r, "col": c})

    doc.save_to_path(dst)

    # verify from disk, not from memory
    check = HwpxDocument.open(dst)
    ctables = table_objects(check)
    for item in report["filled"]:
        got = cell_text(ctables[item["table"]], item["row"], item["col"])
        item["verified"] = got == str(values[item["key"]]).strip()
    try:
        vr = check.validate()
        report["validate_ok"] = bool(getattr(vr, "ok", getattr(vr, "is_valid", True)))
    except Exception as e:  # validator is advisory
        report["validate_ok"] = None
        report["validate_error"] = str(e)[:200]

    print(json.dumps(report, ensure_ascii=False, indent=1))
    bad = report["missing"] or report["ambiguous"] or report["skipped_filled"] or not all(
        i["verified"] for i in report["filled"])
    return 1 if bad else 0


def main(argv):
    if len(argv) >= 2 and argv[0] == "inspect":
        inspect(argv[1])
        return 0
    if len(argv) >= 4 and argv[0] == "fill":
        return fill(argv[1], argv[2], argv[3], force="--force" in argv)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
