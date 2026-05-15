# RepoGraph

Analyses and Visualizes the evolution of a Python Git repository over time.

![Screenshot](images/screenshot.jpeg?)

## Backend

Generate snapshots:

```bash
python -m analysis_engine.cli https://github.com/zeeguu/api
```

| Option            | Description                          | Default Value |
| ----------------- | ------------------------------------ | ------------- |
| `--out`           | Output file path                     | snapshots     |
| `--every`         | Snapshot interval in commits         | 1             |
| `--max-commits`   | Maximum number of commits to process | None          |
| `--package-depth` | Package hierarchy depth              | 1             |

## Frontend

Install and run:

```bash
cd frontend
npm install
npm start
```
