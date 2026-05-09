from dataclasses import dataclass
from pathlib import Path

from analysis_engine.commitsampler import CommitSampler
from analysis_engine.dependencies import DependencyExtractor, module_name_from_file_path, unit_from_module
from analysis_engine.reader import GitRepositoryReader
from analysis_engine.store import SnapshotStore
from analysis_engine.architecture import ArchitectureModelBuilder, ArchitectureSnapshot
import networkx as nx

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
            snapshot = builder.build(
                commit=commit.hash,
                date=commit.author_date.isoformat(),
                message=commit.msg.splitlines()[0] if commit.msg else "",
                author=commit.author.name,
                python_files=python_files,
                edges=edges,
                changed_modules=changed_modules_for_commit(commit, options.package_depth),
            )
            snapshots.append(snapshot)

    store = SnapshotStore(options.output_dir)
    store.write_snapshots(snapshots) # Placeholder for actual snapshots
    return PipelineResult(
        snapshots=[],
        output_dir=options.output_dir,
        timeline_path=[],
    )

# Helper function to determine changed modules of a commit
def changed_modules_for_commit(commit: object, package_depth: int) -> list[str]:
    modules = []
    for modified_file in getattr(commit, "modified_files", []):
        path = getattr(modified_file, "new_path", None) or getattr(modified_file, "old_path", None)
        if not path:
            continue
        module = module_name_from_file_path(path)
        if module:
            modules.append(unit_from_module(module, package_depth))
    return sorted(set(modules))
