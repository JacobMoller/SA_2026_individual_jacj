from pathlib import Path
from analysis_engine.architecture import ArchitectureSnapshot

class SnapshotStore:
    def __init__(self, output_dir: Path) -> None:
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def write_snapshots(self, snapshots: list[ArchitectureSnapshot]) -> Path:
        return self._write_json("snapshots.json", [snapshot.to_dict() for snapshot in snapshots])
    
    def _write_json(self, filename: str, data: list[dict]) -> Path:
        path = self.output_dir / filename
        with path.open("w") as f:
            import json
            json.dump(data, f, indent=2)
        return path