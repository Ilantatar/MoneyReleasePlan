"""
Compare Monday board export (parents + subitems) to Jira Product Discovery ideas (NWLD).

JSON from dump-xlsx-parents.mjs must include `features` (flat parent + subitem rows).
Outputs TSV: Feature \\t Drop (XLS) \\t Drop (JPD)

Usage:
  node scripts/dump-xlsx-parents.mjs <file.xlsx> | Set-Content -Encoding utf8 xlsx-dump.json
  (build jira-all-issues.json via Jira API / MCP — all EPP Ideas with NWLD)
  python scripts/compare-xlsx-jpd-drops.py xlsx-dump.json jira-all-issues.json
  python scripts/compare-xlsx-jpd-drops.py xlsx-dump.json jira-all-issues.json --unmatched-jira

  `features` in the JSON includes every parent row with Drop plus every non-cancelled subitem
  (effective Drop = subitem Drop if set, else parent's Drop buckets).
"""

from __future__ import annotations

import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path


def _stdout_utf8():
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass


def norm_title(s: str) -> str:
    """Lowercase, turn brackets into spaces (keep words inside [Home] etc.), strip punctuation."""
    s = s.lower().replace("[", " ").replace("]", " ")
    s = re.sub(r"[^a-z0-9\s]+", " ", s)
    return " ".join(s.split())


MONDAY_DROP_TO_NUM = {
    "v1(20.4)": 1,
    "v2(4.5)": 2,
    "v3(18.5)": 3,
    "v4(1.6)": 4,
}

JIRA_NWLD_TO_NUM = {
    "v1 (april)": 1,
    "v2 (4-may)": 2,
    "v3 (18-may)": 3,
    "v4 (1-jun)": 4,
}


def monday_drops_to_nums(labels: list[str]) -> list[int]:
    nums = []
    for raw in labels:
        k = raw.strip().lower()
        n = MONDAY_DROP_TO_NUM.get(k)
        if n is not None:
            nums.append(n)
    return sorted(set(nums))


def jira_nwld_to_display(cf) -> tuple[str, list[int]]:
    """Return (display string, list of mapped drop numbers — may be empty)."""
    if not cf or not isinstance(cf, dict):
        return ("-", [])
    val = (cf.get("value") or "").strip()
    if not val:
        return ("-", [])
    k = val.lower()
    n = JIRA_NWLD_TO_NUM.get(k)
    if n is not None:
        return (str(n), [n])
    return (val, [])  # e.g. WebView / TBD


def _token_jaccard(a: str, b: str) -> float:
    ta = set(norm_title(a).split())
    tb = set(norm_title(b).split())
    ta = {t for t in ta if len(t) > 2}
    tb = {t for t in tb if len(t) > 2}
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def _keyword_coverage(name: str, summary: str) -> float:
    """Share of meaningful tokens from `name` that appear in summary (helps 'Deposit - Lean')."""
    tokens = [t for t in norm_title(name).split() if len(t) > 2]
    ns = norm_title(summary or "")
    if not tokens:
        return 0.0
    hits = sum(1 for t in tokens if t in ns)
    return hits / len(tokens)


def _pair_score(xlsx_line: str, summary: str) -> float:
    nx, ns = norm_title(xlsx_line), norm_title(summary or "")
    ratio = SequenceMatcher(None, nx, ns).ratio() if nx and ns else 0.0
    jac = _token_jaccard(xlsx_line, summary or "")
    cov = _keyword_coverage(xlsx_line, summary or "")
    score = 0.45 * ratio + 0.35 * jac + 0.2 * cov
    if jac >= 0.34 and ratio >= 0.28:
        score = max(score, 0.42)
    if cov >= 0.66:
        score = max(score, 0.41)
    ta = set(t for t in nx.split() if len(t) > 2)
    tb = set(t for t in ns.split() if len(t) > 2)
    overlap = len(ta & tb)
    if len(ta) >= 3 and overlap < 2:
        score *= 0.25
    elif len(ta) >= 2 and overlap < 1:
        score = 0.0
    return score


def _match_variants(feat: dict) -> list[str]:
    """Several strings for scoring — parent context helps JPD titles."""
    name = (feat.get("name") or "").strip()
    parent = (feat.get("parentName") or "").strip()
    variants = [name, f"{parent} {name}".strip(), feat.get("displayPath") or name]
    # Dedupe preserving order
    seen: set[str] = set()
    out: list[str] = []
    for v in variants:
        if v and v not in seen:
            seen.add(v)
            out.append(v)
    return out


def match_score_feature_to_summary(feat: dict, summary: str) -> float:
    return max((_pair_score(v, summary) for v in _match_variants(feat)), default=0.0)


def greedy_one_to_one(features: list[dict], issues: list[dict], min_score: float = 0.33):
    pairs: list[tuple[float, int, str]] = []
    keys_to_j = {j["key"]: j for j in issues}
    for fi, feat in enumerate(features):
        for j in issues:
            summ = (j.get("fields") or {}).get("summary") or ""
            sc = match_score_feature_to_summary(feat, summ)
            if sc >= min_score:
                pairs.append((sc, fi, j["key"]))
    pairs.sort(key=lambda t: t[0], reverse=True)
    assigned_f = set()
    assigned_k = set()
    match_f_to_key: dict[int, str] = {}
    for sc, fi, key in pairs:
        if fi in assigned_f or key in assigned_k:
            continue
        assigned_f.add(fi)
        assigned_k.add(key)
        match_f_to_key[fi] = key
    return match_f_to_key, keys_to_j


def load_features(xlsx: dict) -> list[dict]:
    raw = xlsx.get("features")
    if raw:
        return raw
    # Back-compat: parents only
    out = []
    for p in xlsx.get("parents") or []:
        if str(p.get("status", "")).strip().lower() == "cancelled":
            continue
        drops = monday_drops_to_nums(p.get("drops") or [])
        if not drops:
            continue
        nm = p.get("name") or ""
        out.append(
            {
                "kind": "parent",
                "parentName": None,
                "name": nm,
                "displayPath": nm,
                "status": p.get("status") or "",
                "dropRaw": p.get("dropRaw") or "",
                "drops": p.get("drops") or [],
            }
        )
    return out


def print_unmatched_jira_money_adacent(issues: list[dict], matched_keys: set[str]):
    """JPD ideas (Money-adjacent keywords) that no Monday row consumed — review for gaps."""
    kw = ("deposit", "withdraw", "iban", "wallet", "balance", "staking", "card", "payment", "bank")
    print("")
    print("# Unmatched JPD ideas (Money-related keywords, no XLS row matched)")
    print("Jira key\tNWLD\tSummary")
    for j in sorted(issues, key=lambda x: x.get("key") or ""):
        k = j.get("key")
        if not k or k in matched_keys:
            continue
        summ = (j.get("fields") or {}).get("summary") or ""
        low = summ.lower()
        if not any(x in low for x in kw):
            continue
        cf = (j.get("fields") or {}).get("customfield_16296")
        nw = (cf or {}).get("value") if isinstance(cf, dict) else ""
        print(f"{k}\t{nw}\t{summ}")


def main():
    _stdout_utf8()
    argv = [a for a in sys.argv[1:] if a != "--unmatched-jira"]
    report_unmatched = len(argv) < len(sys.argv) - 1
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        sys.exit(1)
    xlsx_path = Path(argv[0])
    jira_path = Path(argv[1])
    with xlsx_path.open(encoding="utf-8-sig") as fp:
        xlsx = json.load(fp)
    with jira_path.open(encoding="utf-8") as fp:
        jira_blob = json.load(fp)
    issues = jira_blob.get("issues") or []

    def active(j):
        st = (j.get("fields") or {}).get("status") or {}
        name = (st.get("name") or "").lower()
        return "cancel" not in name

    issues = [j for j in issues if active(j)]

    features_all = load_features(xlsx)
    features = []
    for f in features_all:
        if str(f.get("status", "")).strip().lower() == "cancelled":
            continue
        mnums = monday_drops_to_nums(f.get("drops") or [])
        if not mnums:
            continue
        features.append(f)

    match_f_to_key, keys_to_j = greedy_one_to_one(features, issues)
    rows = []

    for fi, f in enumerate(features):
        path = f.get("displayPath") or f.get("name") or ""
        mnums = monday_drops_to_nums(f.get("drops") or [])
        xls_cell = ",".join(str(n) for n in mnums) if mnums else "-"

        jkey = match_f_to_key.get(fi)
        j = keys_to_j.get(jkey) if jkey else None
        if j:
            disp, jnums = jira_nwld_to_display((j.get("fields") or {}).get("customfield_16296"))
            jpd_cell = disp
            feat = f"{path} ({j['key']})"
        else:
            jpd_cell = "n/a"
            feat = path

        diff = ""
        if j and jnums:
            if set(mnums) != set(jnums):
                diff = " *"
        elif j and not jnums:
            diff = " *"
        elif not j:
            diff = " *"

        rows.append((diff, feat, xls_cell, jpd_cell, path))

    print("Feature\tDrop (XLS / Monday)\tDrop (JPD / NWLD)")
    for diff, feat, xls, jpd, _path in sorted(rows, key=lambda r: (r[0] == "", r[4].lower())):
        print(f"{feat}\t{xls}\t{jpd}{diff}")

    if report_unmatched:
        print_unmatched_jira_money_adacent(issues, set(match_f_to_key.values()))


if __name__ == "__main__":
    main()
