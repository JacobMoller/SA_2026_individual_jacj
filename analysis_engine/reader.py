from pathlib import Path
from tempfile import TemporaryDirectory

class GitRepositoryReader:
    def __init__(self, repository: str) -> None:
        self._temp_dir: TemporaryDirectory[str] | None = None # Store temp clone of repo
        self.path = self._setup_repository(repository)

    def close(self) -> None:
        if self._temp_dir:
            self._temp_dir.cleanup()
            self._temp_dir = None

    def __enter__(self) -> "GitRepositoryReader":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def _setup_repository(self, repository: str) -> Path:
        #TODO: clone repo?
        return "" #TODO: fix repository reading