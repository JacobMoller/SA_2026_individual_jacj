# RepoGraph

Analyses and Visualizes the evolution of a Python Git repository over time.

![Screenshot](images/screenshot.jpeg?id=1)

## Example of timeline playback
<img width="1920" height="1080" alt="output" src="https://github.com/user-attachments/assets/656054f2-dd68-4043-97e6-42ea98d98b97" />


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
