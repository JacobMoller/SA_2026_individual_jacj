from dataclasses import dataclass
from pathlib import Path

from analysis_engine.commitsampler import CommitSampler
from analysis_engine.dependencies import DependencyExtractor
from analysis_engine.reader import GitRepositoryReader
from analysis_engine.store import SnapshotStore
from analysis_engine.architecture import ArchitectureSnapshot
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
            snapshots.append(ArchitectureSnapshot(commit=commit.hash, date=commit.author_date.isoformat(), message=commit.msg.splitlines()[0] if commit.msg else "", author=commit.author.name, graph=nx.Graph(), dependencies=[], metrics={}, violations=[], changed_modules=[]))

    store = SnapshotStore(options.output_dir)
    store.write_snapshots(snapshots) # Placeholder for actual snapshots
    return PipelineResult(
        snapshots=[],
        output_dir=options.output_dir,
        timeline_path=[],
    )