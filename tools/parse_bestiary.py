#!/usr/bin/env python3
"""Parse Dragons bestiary markdown into JSON files for the API."""

from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source" / "Dragons_3_Bestiaire_Créatures_compressed.md"
OUT_DIR = ROOT / "DragonsGenerator.API" / "Data"
CREATURES_DIR = OUT_DIR / "Creatures"
INDEX_PATH = OUT_DIR / "index" / "creatures.json"

SKIP_HEADINGS = {
    "crédits",
    "table des matières",
    "table of contents",
    "annexes",
    "avant-propos",
    "système modulaire",
    "utiliser les profils",
    "actions",
    "traits",
    "réactions",
    "actions légendaires",
    "l'avis de baldine la guide",
    "les pouvoirs accessibles",
    "les débuts difficiles",
    "la couverture de l'espion",
    "l'intérêt des guildes de voleurs et d'assassins",
    "repaire d'un dragon d'agate",
    "que reste-t-il d'hrysanthéïs aujourd'hui ?",
    "incarner mille visages",
    "mille visages sous sa forme draconique",
    "les aspects",
    "mille visages sous forme",
    "déterminer le fp de la némésis",
    "déterminer les pv de la némésis",
    "trait spécial",
    "némésis : dharka shaan de la maison",
    "la rage du rat-garou",
    "archétype : créer un rat-garou",
    "les chiens sang-arcanes",
    "maisons prédatrices",
    "la maison",
    "objets animés",
    "baguette de commandement de",
    "des intrigants",
}

SECTION_SLUGS = {
    "première partie rencontres dans la cité franche": "cité-franche",
    "deuxième partie": "nature-sauvage",
    "troisième partie rencontres dans le grand kaan": "grand-kaan",
    "dans les rues de la cité franche": "rues-cité-franche",
    "habitants": "habitants",
    "soldats": "soldats",
    "dans les laboratoires et les bibliothèques": "laboratoires",
    "clandestins": "clandestins",
    "faune urbaine": "faune-urbaine",
    "dans les laves d'askamor": "laves-askamor",
    "croyants": "croyants",
    "arcanistes": "arcanistes",
}

CA_PATTERN = re.compile(
    r"Classe d[\u2019'´` ]armure\s*(?:\*\*)?\s*(\d+)\s*(?:\(([^)]+)\))?",
    re.IGNORECASE,
)
HP_PATTERN = re.compile(
    r"Points de vie\s*(?:\*\*)?\s*([^\n\|]+)(?:\s*\|\s*(?:\*\*)?\s*Seuil de blessure\s*(?:\*\*)?\s*(\d+|N\.?\s*A\.?))?",
    re.IGNORECASE,
)
WT_PATTERN = re.compile(
    r"Seuil de blessure\s*(?:\*\*)?\s*(\d+|N\.?\s*A\.?)",
    re.IGNORECASE,
)
SPEED_PATTERN = re.compile(
    r"Vitesse de déplacement\s*\**\s*([^\n•*]+)",
    re.IGNORECASE,
)
FP_PATTERN = re.compile(
    r"Facteur de puissance\s*\**\s*([0-9/]+)\s*\(([\d\s]+)\s*PX\)",
    re.IGNORECASE,
)
ABILITY_ROW = re.compile(
    r"(\d+)\s*\(\s*([+\-−]\d+)\s*\)",
)
HEADING = re.compile(r"^(#{1,3})\s+(.+)$")
BULLET = re.compile(r"^[\s•\*\-]+(.+)$")


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def clean_heading(raw: str) -> str:
    raw = re.sub(r"\*\*", "", raw)
    raw = re.sub(r"<[^>]+>", "", raw)
    raw = re.sub(r"\s+", " ", raw).strip()
    return raw


def normalize_apostrophes(text: str) -> str:
    return (
        text.replace("'", "'")
        .replace("'", "'")
        .replace("`", "'")
        .replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u00a0", " ")
        .replace("−", "-")
    )


def parse_abilities(block: str) -> dict[str, dict[str, int | str]]:
    abilities: dict[str, dict[str, int | str]] = {}
    labels = ["str", "dex", "con", "int", "wis", "cha"]
    rows = ABILITY_ROW.findall(block)
    if len(rows) >= 6:
        for label, (score, mod) in zip(labels, rows[:6]):
            mod = mod.replace("−", "-")
            abilities[label] = {"score": int(score), "modifier": mod}
    return abilities


def preprocess_lines(lines: list[str]) -> list[str]:
    """Flatten markdown table rows that contain stat block content."""
    out: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped.startswith("|"):
            out.append(line)
            continue
        if stripped.startswith("| ---"):
            continue
        cells = [c.strip() for c in stripped.split("|")]
        for cell in cells:
            if not cell or re.fullmatch(r"[-\s]+", cell):
                continue
            cell = cell.replace("\\*", "*").replace("\\|", "|").replace("\\\\", "\\").strip()
            cell = cell.rstrip("\\").strip()
            out.append(cell)
    return out


def should_stop_continuation(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if stripped.startswith("#"):
        return True
    if "<page_number>" in stripped or "Order #" in stripped:
        return True
    if stripped.lower().startswith("illustration"):
        return True
    if "taille" in stripped.lower() and "alignement" in stripped.lower():
        return True
    if CA_PATTERN.search(normalize_apostrophes(stripped)):
        return True
    return False


def section_header_pattern(section_name: str) -> re.Pattern[str]:
    return re.compile(
        rf"(?:^|\n)(?:#{{1,3}}\s*)?(?:\*\*)?{re.escape(section_name)}(?:\*\*)?(?=\s*$|\s*\n)",
        re.IGNORECASE,
    )


def find_block_end(lines: list[str], start: int) -> int:
    saw_fp = False
    fp_index = start
    for i in range(start + 1, min(len(lines), start + 80)):
        line = normalize_apostrophes(lines[i])
        if FP_PATTERN.search(line):
            saw_fp = True
            fp_index = i
            continue
        if not saw_fp:
            continue
        if i <= fp_index + 2:
            continue
        if CA_PATTERN.search(line):
            window = normalize_apostrophes("\n".join(lines[max(start, i - 10) : i + 1]))
            if re.search(
                r"Humanoïde|Bête|Fiélon|Mort-vivant|Monstruosité|Élémentaire|Aberration|Créature|Plante|Construct",
                window,
                re.I,
            ):
                return i
        heading = HEADING.match(lines[i].strip())
        if heading and len(heading.group(1)) >= 2:
            label = clean_heading(heading.group(2))
            if is_valid_creature_name(label) and i > start + 8:
                return i
        if heading and len(heading.group(1)) == 1:
            label = clean_heading(heading.group(2))
            key = slugify(label)
            if key not in SECTION_SLUGS and key not in SKIP_HEADINGS and i > start + 15:
                return i
    return min(len(lines), start + 65)


def extract_section_items(block: str, section_name: str) -> list[dict[str, str]]:
    pattern = section_header_pattern(section_name)
    match = pattern.search(block)
    if not match:
        return []

    text = block[match.end() :]
    next_header = re.search(
        r"\n(?:#+\s*(?:\*\*)?(?:Actions|Traits|Réactions|Actions légendaires|Sorts)(?:\*\*)?(?=\s*$|\s*\n)|\*\*(?:Actions|Traits|Réactions|Actions légendaires|Sorts)\*\*)",
        text,
        re.IGNORECASE,
    )
    if next_header:
        text = text[: next_header.start()]

    items: list[dict[str, str]] = []
    current: dict[str, str] | None = None

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith(">"):
            continue
        if line.startswith("|") or line.startswith("```"):
            break
        if should_stop_continuation(line):
            break

        line = re.sub(r"^[•\-]\s+", "", line)
        if line.startswith("* "):
            line = line[2:].strip()

        item_match = re.match(r"\*\*([^*]+)\*\*\.?\s*(.*)", line, re.DOTALL)
        if item_match:
            if current:
                items.append(current)
            name = item_match.group(1).strip().rstrip(".")
            if name.lower() in {"actions", "traits", "réactions", "sorts"}:
                continue
            current = {"name": name, "description": item_match.group(2).strip()}
            continue

        if current and line:
            if should_stop_continuation(line):
                break
            sep = "\n" if current["description"] else ""
            current["description"] = f"{current['description']}{sep}{line}"

    if current:
        items.append(current)
    return items


def is_valid_creature_name(name: str) -> bool:
    key = slugify(name)
    if key in SKIP_HEADINGS or key in SECTION_SLUGS:
        return False
    if len(name) < 2 or len(name) > 80:
        return False
    lowered = name.lower()
    if lowered.startswith("table"):
        return False
    if lowered.startswith("logo ") or lowered.startswith("icon ") or " icon " in lowered:
        return False
    if "**" in name:
        return False
    if re.fullmatch(r"\d+", name):
        return False
    if lowered.startswith("bête de ") or lowered.startswith("bete de "):
        return False
    if "taille" in lowered and ("alignement" in lowered or "non align" in lowered):
        return False
    if lowered in {
        "humanoïde",
        "humanoide",
        "créature inconnue",
        "creature inconnue",
        "adulte",
        "jeune",
        "vénérable",
        "venerable",
    }:
        return False
    words = name.split()
    if len(words) >= 4 and words[: len(words) // 2] == words[len(words) // 2 :]:
        return False
    return True


def find_creature_name(lines: list[str], ca_index: int) -> tuple[str, int]:
    for i in range(ca_index - 1, max(0, ca_index - 10), -1):
        line = lines[i].strip()
        m = HEADING.match(line)
        if not m:
            continue
        if len(m.group(1)) < 2:
            continue
        name = clean_heading(m.group(2))
        if is_valid_creature_name(name):
            return name, i

    for i in range(ca_index - 1, max(0, ca_index - 40), -1):
        line = lines[i].strip()
        m = HEADING.match(line)
        if not m:
            continue
        name = clean_heading(m.group(2))
        if is_valid_creature_name(name):
            return name, i

    for i in range(ca_index - 1, max(0, ca_index - 8), -1):
        line = lines[i].strip()
        if not line or HEADING.match(line) or line.startswith("|"):
            continue
        if "Illustration" in line or line.startswith(">"):
            continue
        if "taille" in line.lower() and "alignement" in line.lower():
            continue
        if is_valid_creature_name(line):
            return line, i

    return "Créature inconnue", ca_index


def find_flavor_text(lines: list[str], name: str, stat_start: int) -> str:
    parts: list[str] = []
    name_lower = name.lower()
    passed_stat_title = False
    for i in range(stat_start - 1, max(0, stat_start - 80), -1):
        line = lines[i].strip()
        if not line:
            if parts:
                break
            continue
        heading = HEADING.match(line)
        if heading:
            heading_text = clean_heading(heading.group(2))
            if heading_text.lower() == name_lower:
                passed_stat_title = True
                continue
            if slugify(heading_text) in SECTION_SLUGS or slugify(heading_text) in SKIP_HEADINGS:
                break
            if passed_stat_title:
                break
        if not passed_stat_title:
            continue
        if line.startswith("|") or line.startswith("```"):
            break
        if line.startswith(">") or line.startswith("•") or line.startswith("*"):
            continue
        if re.match(r"^\d+$", line):
            continue
        if "Illustration" in line or "Order #" in line or "<page_number>" in line:
            continue
        if "taille" in line.lower() and "alignement" in line.lower():
            break
        parts.insert(0, line)
        if len(parts) >= 4:
            break
    return " ".join(parts).strip()


def resolve_category(section: str | None, subsection: str | None) -> str:
    if subsection and subsection in SECTION_SLUGS.values():
        return subsection
    if section and section in SECTION_SLUGS.values():
        return section
    return subsection or section or "divers"


def parse_creature_block(lines: list[str], ca_index: int, context: dict[str, str | None]) -> dict:
    name, name_index = find_creature_name(lines, ca_index)
    end = find_block_end(lines, ca_index)
    block = normalize_apostrophes("\n".join(lines[ca_index:end]))
    stats_block = re.sub(r"^[•\*\-]\s+", "", block, flags=re.MULTILINE)
    stats_block = stats_block.replace("**", "")

    ca_match = CA_PATTERN.search(stats_block)
    if not ca_match:
        raise ValueError("Missing armor class")

    type_line = ""
    for i in range(ca_index - 1, max(0, ca_index - 6), -1):
        candidate = lines[i].strip()
        if not candidate or candidate.startswith("#") or candidate.startswith("|"):
            continue
        if "Illustration" in candidate:
            continue
        if len(candidate) > 15 and not candidate.startswith("•") and not candidate.startswith("*"):
            type_line = candidate
            break

    hp_match = HP_PATTERN.search(stats_block)
    speed_match = SPEED_PATTERN.search(stats_block)
    fp_match = FP_PATTERN.search(stats_block)
    abilities = parse_abilities(stats_block)

    skills = ""
    saves = ""
    senses = ""
    languages = ""
    for line in stats_block.splitlines():
        plain = normalize_apostrophes(line)
        if "Compétences" in plain:
            skills = re.sub(r"^[\s•\*\-]+", "", plain.split("Compétences")[-1]).strip(" :*")
        elif "Jets de sauvegarde" in plain:
            saves = re.sub(r"^[\s•\*\-]+", "", plain.split("Jets de sauvegarde")[-1]).strip(" :*")
        elif "Sens" in plain and "Perception" in plain:
            senses = re.sub(r"^[\s•\*\-]+", "", plain.split("Sens")[-1]).strip(" :*")
        elif "Langues" in plain:
            languages = re.sub(r"^[\s•\*\-]+", "", plain.split("Langues")[-1]).strip(" :*")

    traits = extract_section_items(block, "Traits")
    actions = extract_section_items(block, "Actions")
    reactions = extract_section_items(block, "Réactions")
    legendary = extract_section_items(block, "Actions légendaires")

    cr = fp_match.group(1) if fp_match else "0"
    xp_raw = re.sub(r"\s+", "", fp_match.group(2)) if fp_match else "0"

    wound_threshold = None
    if hp_match and hp_match.group(2) and not re.search(r"n\.?\s*a\.?", hp_match.group(2), re.I):
        wound_threshold = int(hp_match.group(2))
    else:
        wt = WT_PATTERN.search(stats_block)
        if wt and not re.search(r"n\.?\s*a\.?", wt.group(1), re.I):
            wound_threshold = int(wt.group(1))

    category = resolve_category(context.get("section"), context.get("subsection"))

    return {
        "name": name,
        "name_index": name_index,
        "category": category,
        "part": context.get("part"),
        "section": context.get("section_label"),
        "type_line": type_line,
        "armor_class": int(ca_match.group(1)),
        "armor_note": (ca_match.group(2) or "").strip(),
        "hit_points": hp_match.group(1).strip() if hp_match else "",
        "wound_threshold": wound_threshold,
        "speed": speed_match.group(1).strip() if speed_match else "",
        "abilities": abilities,
        "saving_throws": saves,
        "skills": skills,
        "senses": senses,
        "languages": languages,
        "challenge_rating": cr,
        "xp": int(xp_raw) if xp_raw.isdigit() else 0,
        "traits": traits,
        "actions": actions,
        "reactions": reactions,
        "legendary_actions": legendary,
        "flavor_text": find_flavor_text(lines, name, ca_index),
    }


def update_context(line: str, context: dict[str, str | None]) -> None:
    m = HEADING.match(line.strip())
    if not m:
        return
    level = len(m.group(1))
    label = clean_heading(m.group(2))
    key = slugify(label)

    if "partie" in key and level == 1:
        context["part"] = label
        context["section"] = None
        context["section_label"] = None
        context["subsection"] = None
        context["subsection_label"] = None
        return

    if level == 1 and key in SECTION_SLUGS:
        context["section"] = SECTION_SLUGS[key]
        context["section_label"] = label
        context["subsection"] = None
        context["subsection_label"] = None
        return

    if level == 2 and key in SECTION_SLUGS:
        context["subsection"] = SECTION_SLUGS[key]
        context["subsection_label"] = label
        return


def main() -> None:
    text = SOURCE.read_text(encoding="utf-8")
    lines = preprocess_lines(text.splitlines())

    context: dict[str, str | None] = {
        "part": None,
        "section": None,
        "section_label": None,
        "subsection": None,
        "subsection_label": None,
    }

    creatures: list[dict] = []
    seen_names: Counter[str] = Counter()

    for idx, line in enumerate(lines):
        update_context(line, context)
        normalized_line = normalize_apostrophes(line)
        if "classe d" not in normalized_line.lower() or "armure" not in normalized_line.lower():
            continue
        if normalized_line.strip().startswith("- "):
            continue
        if normalized_line.strip().startswith("|"):
            continue
        try:
            parsed = parse_creature_block(lines, idx, context)
        except ValueError:
            continue
        if not is_valid_creature_name(parsed["name"]):
            continue
        creatures.append(parsed)

    slug_counts: Counter[str] = Counter()
    index_entries = []
    by_category: dict[str, int] = defaultdict(int)
    by_cr: dict[str, int] = defaultdict(int)

    for creature in creatures:
        base_slug = slugify(creature["name"])
        slug_counts[base_slug] += 1
        suffix = "" if slug_counts[base_slug] == 1 else f"-{slug_counts[base_slug]}"
        creature_id = f"cre-{base_slug}{suffix}"

        detail = {
            "schema_version": "1.0",
            "id": creature_id,
            "name": creature["name"],
            "category": creature["category"],
            "part": creature["part"],
            "section": creature["section"],
            "type": creature["type_line"],
            "armor_class": creature["armor_class"],
            "armor_note": creature["armor_note"] or None,
            "hit_points": creature["hit_points"],
            "wound_threshold": creature["wound_threshold"],
            "speed": creature["speed"],
            "abilities": creature["abilities"],
            "saving_throws": creature["saving_throws"] or None,
            "skills": creature["skills"] or None,
            "senses": creature["senses"] or None,
            "languages": creature["languages"] or None,
            "challenge_rating": creature["challenge_rating"],
            "xp": creature["xp"],
            "traits": creature["traits"],
            "actions": creature["actions"],
            "reactions": creature["reactions"],
            "legendary_actions": creature["legendary_actions"],
            "description": creature["flavor_text"],
        }

        category = creature["category"]
        by_category[category] += 1
        by_cr[creature["challenge_rating"]] += 1

        rel_dir = CREATURES_DIR / category
        rel_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"{creature_id}.json"
        file_path = rel_dir / file_name
        file_path.write_text(
            json.dumps(detail, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        index_entries.append(
            {
                "id": creature_id,
                "name": creature["name"],
                "category": category,
                "part": creature["part"],
                "section": creature["section"],
                "challenge_rating": creature["challenge_rating"],
                "xp": creature["xp"],
                "armor_class": creature["armor_class"],
                "file": f"Creatures/{category}/{file_name}",
            }
        )

    index = {
        "schema_version": "1.0",
        "description": "Index du bestiaire Dragons. Chaque entrée référence un fichier JSON dans Creatures/.",
        "source_books": ["Dragons - Bestiaire : Créatures"],
        "language": "fr",
        "stats": {
            "total": len(index_entries),
            "by_category": dict(sorted(by_category.items())),
            "by_challenge_rating": dict(sorted(by_cr.items(), key=lambda x: (x[0] != "0", x[0]))),
        },
        "creatures": sorted(index_entries, key=lambda e: (e["category"], e["name"].lower())),
    }

    INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Parsed {len(index_entries)} creatures into {CREATURES_DIR}")
    print(f"Index written to {INDEX_PATH}")


if __name__ == "__main__":
    main()
