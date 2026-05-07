from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
from urllib.parse import urlparse

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
        repo_path = Path(repository).expanduser()
        if repo_path.exists():
            return repo_path.resolve()
        
        if not _looks_like_git_url(repository):
            raise ValueError(f"Repository path {repository} does not exist.")
        
        # Create temp directory
        self._temp_dir = TemporaryDirectory(prefix="repograph-clone-")
        target = Path(self._temp_dir.name) / "repo"


        # clone to that temp directory
        subprocess.run(
            ["git", "clone", "--quiet", repository, str(target)],
            check=True,
            text=True,
            capture_output=True,
        )

        return target
    
def _looks_like_git_url(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https", "ssh", "git"} or value.endswith(".git") # Simple git url-check