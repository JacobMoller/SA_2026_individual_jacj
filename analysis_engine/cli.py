from __future__ import annotations

import argparse
from pathlib import Path

from analysis_engine.pipeline import run_pipeline, PipelineOptions

# Inspiration from https://realpython.com/command-line-interfaces-python-argparse/

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scrape a Python Git repository and reconstruct package-level architecture over commits."
    )
    parser.add_argument("repository", help="Local path or remote Git URL")
    parser.add_argument("--out", default="snapshots", help="Output directory")
    parser.add_argument("--every", type=int, default=1, help="Keep every Nth commit")
    parser.add_argument("--max-commits", type=int, help="Maximum sampled commits")
    parser.add_argument(
        "--package-depth",
        type=int,
        default=1,
        help="Architecture unit depth. 1 maps src/auth/login.py to auth.",
    )
    args = parser.parse_args()

    result = run_pipeline(
        PipelineOptions(
            repository=args.repository,
            output_dir=Path(args.out),
            every=args.every,
            max_commits=args.max_commits,
            package_depth=args.package_depth,
        )
    )

    print(f"Wrote {len(result.snapshots)} snapshots to {result.output_dir}")
    print(f"Timeline: {result.timeline_path}")


if __name__ == "__main__":
    main()
