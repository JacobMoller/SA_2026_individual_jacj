from dataclasses import dataclass
from pathlib import Path

from analysis_engine.dependencies import DependencyExtractor
from analysis_engine.store import SnapshotStore
from analysis_engine.architecture import ArchitectureSnapshot

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
    python_file = extractor.python_file("/auth/example.py", "print('Hello, world!')")

    print(f"Extracted Python file: {python_file}")

    store = SnapshotStore(options.output_dir)
    store.write_snapshots([]) # Placeholder for actual snapshots
    return PipelineResult(
        snapshots=[],
        output_dir=options.output_dir,
        timeline_path=[],
    )