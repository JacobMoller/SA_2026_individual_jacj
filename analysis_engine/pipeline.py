from dataclasses import dataclass
from pathlib import Path

from analysis_engine.commitsampler import CommitSampler
from analysis_engine.dependencies import DependencyExtractor, module_name_from_file_path, unit_from_module
from analysis_engine.reader import GitRepositoryReader
from analysis_engine.store import SnapshotStore
from analysis_engine.architecture import ArchitectureModelBuilder, ArchitectureSnapshot
from collections import defaultdict
from itertools import combinations

@dataclass(frozen=True)
class PipelineOptions:
    repository: str
    output_dir: Path
    every: int = 1
    max_commits: int | None = None
    package_depth: int = 1

@dataclass(frozen=True)
class PipelineResult:
    snapshots: list[ArchitectureSnapshot]
    output_dir: Path
    timeline_path: Path

def run_pipeline(options: PipelineOptions) -> PipelineResult:
    print(f"Running pipeline with options: {options}")
    extractor = DependencyExtractor(package_depth=options.package_depth)
    builder = ArchitectureModelBuilder()
    python_file = extractor.python_file("/auth/example.py", "print('Hello, world!')")
    print(f"Extracted Python file: {python_file}")

    sampler = CommitSampler(
        repository=options.repository,
        every=options.every,
        max_commits=options.max_commits,
    )
    snapshots: list[ArchitectureSnapshot] = []
    cochange_counts: defaultdict[tuple[str, str], int] = defaultdict(int)
    cochange_evidence: defaultdict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)

    with GitRepositoryReader(options.repository) as reader:
        for commit in sampler.sample():
            print(f"Processing commit: {commit.msg}")
            raw_files = reader.python_files_at(commit.hash)
            python_files = [
                parsed
                for path, source in raw_files.items()
                if (parsed := extractor.python_file(path, source)) is not None
            ]
            edges = extractor.extract(python_files)
            module_changes = module_changes_for_commit(commit, options.package_depth)
            changed_modules = sorted({str(change["module"]) for change in module_changes})
            update_implicit_dependencies(
                cochange_counts=cochange_counts,
                cochange_evidence=cochange_evidence,
                commit=commit,
                module_changes=module_changes,
            )
            snapshot = builder.build(
                commit=commit.hash,
                date=commit.author_date.isoformat(),
                message=commit.msg.splitlines()[0] if commit.msg else "",
                author=commit.author.name,
                python_files=python_files,
                edges=edges,
                changed_modules=changed_modules,
                module_changes=module_changes,
                implicit_dependencies=serialise_implicit_dependencies(
                    modules={file.unit for file in python_files} | set(changed_modules),
                    cochange_counts=cochange_counts,
                    cochange_evidence=cochange_evidence,
                ),
            )
            snapshots.append(snapshot)

    store = SnapshotStore(options.output_dir)
    timeline_path = store.write_snapshots(snapshots)
    return PipelineResult(
        snapshots=snapshots,
        output_dir=options.output_dir,
        timeline_path=timeline_path,
    )

# Helper function to determine changed modules of a commit
def changed_modules_for_commit(commit: object, package_depth: int) -> list[str]:
    return sorted({str(change["module"]) for change in module_changes_for_commit(commit, package_depth)})

def module_changes_for_commit(commit: object, package_depth: int) -> list[dict[str, object]]:
    changes: list[dict[str, object]] = []
    for modified_file in getattr(commit, "modified_files", []):
        path = getattr(modified_file, "new_path", None) or getattr(modified_file, "old_path", None)
        if not path or not path.endswith(".py"):
            continue
        module = module_name_from_file_path(path)
        if not module:
            continue
        unit = unit_from_module(module, package_depth)
        if not unit:
            continue
        change_type = getattr(modified_file, "change_type", "")
        changes.append(
            {
                "module": unit,
                "path": path,
                "old_path": getattr(modified_file, "old_path", None),
                "new_path": getattr(modified_file, "new_path", None),
                "change_type": getattr(change_type, "name", str(change_type)).lower(),
                "added_lines": getattr(modified_file, "added_lines", 0) or 0,
                "deleted_lines": getattr(modified_file, "deleted_lines", 0) or 0,
            }
        )
    return changes

def update_implicit_dependencies(
    *,
    cochange_counts: defaultdict[tuple[str, str], int],
    cochange_evidence: defaultdict[tuple[str, str], list[dict[str, object]]],
    commit: object,
    module_changes: list[dict[str, object]],
) -> None:
    modules = sorted({str(change["module"]) for change in module_changes})
    changes_by_module = {
        module: [change for change in module_changes if change["module"] == module]
        for module in modules
    }
    for source, target in combinations(modules, 2):
        pair = tuple(sorted((source, target)))
        cochange_counts[pair] += 1
        cochange_evidence[pair].append(
            {
                "commit": commit.hash,
                "date": commit.author_date.isoformat(),
                "message": commit.msg.splitlines()[0] if commit.msg else "",
                "files": sorted(
                    {
                        str(change["path"])
                        for change in changes_by_module[source] + changes_by_module[target]
                    }
                ),
            }
        )


def serialise_implicit_dependencies(
    *,
    modules: set[str],
    cochange_counts: defaultdict[tuple[str, str], int],
    cochange_evidence: defaultdict[tuple[str, str], list[dict[str, object]]],
) -> dict[str, object]:
    edges = []
    for (source, target), weight in sorted(cochange_counts.items()):
        evidence = cochange_evidence[(source, target)]
        edges.append(
            {
                "source": source,
                "target": target,
                "weight": weight,
                "commits": len(evidence),
                "files": sorted({file for item in evidence for file in item["files"]}),
                "evidence": evidence[-10:],
            }
        )
    edge_modules = {module for edge in edges for module in (edge["source"], edge["target"])}
    return {
        "nodes": [{"id": module} for module in sorted(modules | edge_modules)],
        "edges": edges,
    }