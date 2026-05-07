
from dataclasses import dataclass
import networkx as nx

@dataclass(frozen=True)
class ArchitectureSnapshot:
    commit: str
    date: str
    message: str
    author: str
    graph: nx.DiGraph
    dependencies: list[dict[str, object]]
    metrics: dict[str, object]
    violations: list[dict[str, object]]
    changed_modules: list[str]

    def to_dict(self) -> dict[str, object]:
        return {
            "commit": self.commit,
            "date": self.date,
            "message": self.message,
            "author": self.author,
            "graph": serialise_graph(self.graph),
            "dependencies": self.dependencies,
            "metrics": self.metrics,
            "violations": self.violations,
            "changed_modules": self.changed_modules,
        }
    
def serialise_graph(graph: nx.DiGraph) -> dict[str, object]:
    return {
        "directed": True,
        "nodes": sorted(({"id": node} for node in graph.nodes), key=lambda item: item["id"]),
        "edges": [
            {"source": source, "target": target, "weight": data.get("weight", 1)}
            for source, target, data in sorted(graph.edges(data=True))
        ],
    }