
from dataclasses import dataclass
from typing import Iterable
import networkx as nx
from collections import Counter

from analysis_engine.dependencies import DependencyEdge, PythonFile

@dataclass(frozen=True)
class ArchitectureSnapshot:
    commit: str
    date: str
    message: str
    author: str
    graph: nx.DiGraph
    dependencies: list[dict[str, object]]
    changed_modules: list[str]

    def to_dict(self) -> dict[str, object]:
        return {
            "commit": self.commit,
            "date": self.date,
            "message": self.message,
            "author": self.author,
            "graph": serialise_graph(self.graph),
            "dependencies": self.dependencies,
            "changed_modules": self.changed_modules,
        }
    

class ArchitectureModelBuilder:
    """Turn edges into a graph-based model"""

    def build(
        self,
        *,
        commit: str,
        date: str,
        message: str,
        author: str,
        python_files: Iterable[PythonFile],
        edges: Iterable[DependencyEdge],
        changed_modules: Iterable[str] = (),
    ) -> ArchitectureSnapshot:
        files = list(python_files)
        edge_weights: Counter[tuple[str, str]] = Counter(
            (edge.source, edge.target)
            for edge in edges
            if edge.source != edge.target
        )
        units = sorted({file.unit for file in files})
        graph = nx.DiGraph()
        graph.add_nodes_from(units)
        for (source, target), weight in edge_weights.items():
            graph.add_edge(source, target, weight=weight)

        dependencies = serialise_graph(graph)["edges"]

        return ArchitectureSnapshot(
            commit=commit,
            date=date,
            message=message,
            author=author,
            graph=graph,
            dependencies=dependencies,
            changed_modules=sorted(set(changed_modules)),
        )

    
def serialise_graph(graph: nx.DiGraph) -> dict[str, object]:
    return {
        "directed": True,
        "nodes": sorted(({"id": node} for node in graph.nodes), key=lambda item: item["id"]),
        "edges": [
            {"source": source, "target": target, "weight": data.get("weight", 1)}
            for source, target, data in sorted(graph.edges(data=True))
        ],
    }