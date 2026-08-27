#!/usr/bin/env python3
"""Verify generated creature JSON against the original bestiary PDF."""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "source" / "Dragons_3_Bestiaire_Créatures.pdf"
INDEX_PATH = ROOT / "DragonsGenerator.API" / "Data" / "index" / "creatures.json"
DATA_DIR = ROOT / "DragonsGenerator.API" / "Data"
CACHE_PATH = ROOT / "tools" / ".bestiary_pdf_text.txt"

CA_RE = re.compile(r"Classe d[\u2019'´` ]armure\s*(\d+)", re.I)
HP_RE = re.compile(
    r"Points de vie\s*([^\|]+?)\s*\|\s*Seuil de blessure\s*(\d+|N\.?\s*A\.?)",
    re.I,
)
FP_RE = re.compile(r"Facteur de puissance\s*([0-9/]+)\s*\(([\d\s]+)\s*PX\)", re.I)
ABILITY_RE = re.compile(r"(\d+)\s*\(\s*([+-]\d+)\s*\)")


def normalize_apostrophes(text: str) -> str:
    return (
        text.replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u00a0", " ")
        .replace("−", "-")
    )


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.replace("\u2019", "'").replace("\u2018", "'").replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


def slugify(text: str) -> str:
    return normalize(text).replace(" ", "-")


def load_pdf_text() -> str:
    if CACHE_PATH.exists() and CACHE_PATH.stat().st_mtime >= PDF_PATH.stat().st_mtime:
        return CACHE_PATH.read_text(encoding="utf-8")

    print(f"Extracting text from PDF ({PDF_PATH.stat().st_size // 1_000_000} MB)...")
    doc = pymupdf.open(PDF_PATH)
    parts: list[str] = []
    for i, page in enumerate(doc):
        parts.append(page.get_text("text"))
        if (i + 1) % 50 == 0:
            print(f"  page {i + 1}/{doc.page_count}")
    text = "\n".join(parts)
    CACHE_PATH.write_text(text, encoding="utf-8")
    print(f"Cached PDF text ({len(text):,} chars) -> {CACHE_PATH}")
    return text


def find_stat_window(pdf_text: str, name: str, armor_class: int, cr: str) -> str | None:
    """Find the stat block window in PDF text for a creature."""
    pdf_norm = normalize_apostrophes(pdf_text)
    name_norm = normalize_apostrophes(name)
    for match in re.finditer(re.escape(name_norm), pdf_norm, re.I):
        start = match.start()
        window = pdf_norm[start : start + 3000]
        if not CA_RE.search(window):
            continue
        ca = int(CA_RE.search(window).group(1))
        if ca != armor_class:
            continue
        fp = FP_RE.search(window)
        if fp and fp.group(1) != cr:
            continue
        return window
    return None


@dataclass
class Issue:
    creature_id: str
    name: str
    field: str
    expected: str
    actual: str


@dataclass
class Report:
    total: int = 0
    found_in_pdf: int = 0
    missing_in_pdf: list[str] = field(default_factory=list)
    issues: list[Issue] = field(default_factory=list)


def verify_creature(pdf_text: str, creature: dict) -> tuple[bool, list[Issue]]:
    issues: list[Issue] = []
    cid = creature["id"]
    name = creature["name"]
    window = find_stat_window(pdf_text, name, creature["armor_class"], creature["challenge_rating"])
    if not window:
        return False, issues

    ca_match = CA_RE.search(window)
    if ca_match and int(ca_match.group(1)) != creature["armor_class"]:
        issues.append(Issue(cid, name, "armor_class", str(creature["armor_class"]), ca_match.group(1)))

    hp_match = HP_RE.search(window)
    if hp_match:
        pdf_hp = normalize_apostrophes(re.sub(r"\s+", " ", hp_match.group(1)).strip())
        json_hp = normalize_apostrophes(creature.get("hit_points", "").strip())
        if pdf_hp != json_hp:
            issues.append(Issue(cid, name, "hit_points", json_hp, pdf_hp))

        wt = hp_match.group(2)
        if re.search(r"n\.?\s*a\.?", wt, re.I):
            pdf_wt = None
        else:
            pdf_wt = int(wt)
        if creature.get("wound_threshold") != pdf_wt:
            issues.append(
                Issue(
                    cid,
                    name,
                    "wound_threshold",
                    str(creature.get("wound_threshold")),
                    str(pdf_wt),
                )
            )

    fp_match = FP_RE.search(window)
    if fp_match:
        if fp_match.group(1) != creature["challenge_rating"]:
            issues.append(
                Issue(cid, name, "challenge_rating", creature["challenge_rating"], fp_match.group(1))
            )
        pdf_xp = int(re.sub(r"\s+", "", fp_match.group(2)))
        if pdf_xp != creature.get("xp", 0):
            issues.append(Issue(cid, name, "xp", str(creature.get("xp")), str(pdf_xp)))

    pdf_abilities = ABILITY_RE.findall(window)
    json_abilities = creature.get("abilities", {})
    labels = ["str", "dex", "con", "int", "wis", "cha"]
    if len(pdf_abilities) >= 6 and json_abilities:
        for label, (score, mod) in zip(labels, pdf_abilities[:6]):
            entry = json_abilities.get(label)
            if not entry:
                continue
            if int(entry["score"]) != int(score):
                issues.append(
                    Issue(cid, name, f"abilities.{label}.score", str(entry["score"]), score)
                )
            if entry["modifier"] != mod:
                issues.append(
                    Issue(cid, name, f"abilities.{label}.modifier", entry["modifier"], mod)
                )

    if not creature.get("traits") and re.search(r"\bTraits\b", window, re.I):
        issues.append(Issue(cid, name, "traits", "missing", "present in PDF"))

    if not creature.get("actions") and re.search(r"\bActions\b", window, re.I):
        issues.append(Issue(cid, name, "actions", "missing", "present in PDF"))

    if not creature.get("description"):
        issues.append(Issue(cid, name, "description", "empty", "should have flavor text"))

    return True, issues


def count_pdf_stat_blocks(pdf_text: str) -> int:
    return len(CA_RE.findall(pdf_text))


def main() -> int:
    if not PDF_PATH.exists():
        print(f"PDF not found: {PDF_PATH}")
        return 1

    index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    pdf_text = load_pdf_text()
    pdf_ca_count = count_pdf_stat_blocks(pdf_text)

    report = Report(total=len(index["creatures"]))
    print(f"JSON creatures: {report.total}")
    print(f"PDF CA lines:   {pdf_ca_count}")

    for entry in index["creatures"]:
        detail_path = DATA_DIR / entry["file"].replace("/", "\\")
        creature = json.loads(detail_path.read_text(encoding="utf-8"))
        found, issues = verify_creature(pdf_text, creature)
        if found:
            report.found_in_pdf += 1
            report.issues.extend(issues)
        else:
            report.missing_in_pdf.append(f"{entry['id']} ({entry['name']})")

    print()
    print(f"Found in PDF: {report.found_in_pdf}/{report.total}")
    print(f"Missing in PDF: {len(report.missing_in_pdf)}")
    print(f"Field issues: {len(report.issues)}")

    if report.missing_in_pdf:
        print("\n--- Missing in PDF (first 30) ---")
        for item in report.missing_in_pdf[:30]:
            print(f"  {item}")
        if len(report.missing_in_pdf) > 30:
            print(f"  ... and {len(report.missing_in_pdf) - 30} more")

    by_field: dict[str, int] = {}
    for issue in report.issues:
        by_field[issue.field] = by_field.get(issue.field, 0) + 1
    if by_field:
        print("\n--- Issues by field ---")
        for field, count in sorted(by_field.items(), key=lambda x: -x[1]):
            print(f"  {field}: {count}")

    if report.issues:
        print("\n--- Sample issues (first 40) ---")
        for issue in report.issues[:40]:
            print(f"  [{issue.creature_id}] {issue.name} :: {issue.field}: json={issue.expected!r} pdf={issue.actual!r}")

    out_path = ROOT / "tools" / "verify_bestiary_report.json"
    out_path.write_text(
        json.dumps(
            {
                "json_total": report.total,
                "pdf_ca_count": pdf_ca_count,
                "found_in_pdf": report.found_in_pdf,
                "missing_in_pdf": report.missing_in_pdf,
                "issues": [issue.__dict__ for issue in report.issues],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"\nFull report: {out_path}")
    return 0 if not report.missing_in_pdf and not report.issues else 1


if __name__ == "__main__":
    sys.exit(main())
