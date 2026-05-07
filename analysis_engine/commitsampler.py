from __future__ import annotations
from collections.abc import Iterator
from pydriller import Repository

# Inspiration from "Analyzing Git Repositories with PyDriller" by Felix Gutierrez. Source: https://blog.devgenius.io/analyzing-git-repositories-with-pydriller-b805f2cd9db0

class CommitSampler:
    def __init__(
        self,
        *,
        repository: str,
        every: int = 1,
        max_commits: int | None = None,
    ) -> None:
        if every < 1:
            raise ValueError("every must be >= 1")
        self.repository = repository
        self.every = every
        self.max_commits = max_commits

    def sample(self) -> Iterator[object]:
        # Yield as we do not know the number of commits until we clone, so send it as we go.
        yielded = 0 # Keep track of how many yields, to respect max_commits option flag.
        for index, commit in enumerate(
            Repository(
                path_to_repo=self.repository,
                only_modifications_with_file_types=[".py"], # Skip commits without Python changes
            ).traverse_commits()
        ):
            if index % self.every != 0:
                continue
            yield commit
            yielded += 1
            if self.max_commits is not None and yielded >= self.max_commits:
                break

