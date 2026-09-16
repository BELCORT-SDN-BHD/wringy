from pathlib import Path
import json
root = Path(__file__).resolve().parents[1]
required = ["AGENTS.md", "CONTEXT.md", "docs/agents/issue-tracker.md", "docs/agents/domain.md", "docs/agents/triage-labels.md", "docs/planning/catalog.json"]
for name in required:
    assert (root / name).is_file(), f"Missing {name}"
catalog = json.loads((root / "docs/planning/catalog.json").read_text())
items = catalog["specs"] + catalog["tickets"]
ids = [x["id"] for x in items]
assert len(ids) == len(set(ids)), "Duplicate planning IDs"
tickets = {x["id"]: x for x in catalog["tickets"]}
for item in items:
    assert (root / item["path"]).is_file(), item["path"]
    assert item["milestone"] in {"M1", "M2", "M3", "M4", "M5"}
visiting, done = set(), set()
def visit(key):
    assert key in tickets, f"Missing dependency {key}"
    assert key not in visiting, f"Dependency cycle {key}"
    if key in done: return
    visiting.add(key)
    for dep in tickets[key].get("blocked_by", []): visit(dep)
    visiting.remove(key)
    done.add(key)
for key in tickets: visit(key)
print(f"Validated {len(catalog['specs'])} specifications and {len(tickets)} tasks; dependencies acyclic.")
