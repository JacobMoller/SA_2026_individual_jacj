# RepoGraph

Analyses and Visualizes the evolution of a Python Git repository over time.

## Backend

Generate snapshots:

```bash
python -m analysis_engine.cli https://github.com/zeeguu/api
```

| Option            | Description                          |
| ----------------- | ------------------------------------ |
| `--out`           | Output file path                     |
| `--every`         | Snapshot interval in commits         |
| `--max-commits`   | Maximum number of commits to process |
| `--package-depth` | Package hierarchy depth              |
