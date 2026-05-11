
from dataclasses import dataclass
from typing import Iterable
import networkx as nx
from collections import Counter, defaultdict

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
    module_changes: list[dict[str, object]]
    implicit_dependencies: dict[str, object]

    def to_dict(self) -> dict[str, object]:
        return {
            "commit": self.commit,
            "date": self.date,
            "message": self.message,
            "author": self.author,
            "graph": serialise_graph(self.graph),
            "dependencies": self.dependencies,
            "changed_modules": self.changed_modules,
            "module_changes": self.module_changes,
            "implicit_dependencies": self.implicit_dependencies,
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
        module_changes: Iterable[dict[str, object]] = (),
        implicit_dependencies: dict[str, object] | None = None,
    ) -> ArchitectureSnapshot:
        files = list(python_files)
        edge_weights: Counter[tuple[str, str]] = Counter(
            (edge.source, edge.target)
            for edge in edges
            if edge.source != edge.target
        )
        edge_imports: defaultdict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
        for edge in edges:
            if edge.source == edge.target:
                continue
            edge_imports[(edge.source, edge.target)].append(
                {
                    "file": edge.source_file,
                    "import": edge.import_name,
                }
            )
        units = sorted({file.unit for file in files})
        graph = nx.DiGraph()
        graph.add_nodes_from(units)
        for (source, target), weight in edge_weights.items():
            graph.add_edge(
                source,
                target,
                weight=weight,
                imports=sorted(edge_imports[(source, target)], key=lambda item: (item["file"], item["import"])),
            )

        dependencies = serialise_graph(graph)["edges"]

        return ArchitectureSnapshot(
            commit=commit,
            date=date,
            message=message,
            author=author,
            graph=graph,
            dependencies=dependencies,
            changed_modules=sorted(set(changed_modules)),
            module_changes=sorted(module_changes, key=lambda item: str(item.get("path", ""))),
            implicit_dependencies=implicit_dependencies or {"nodes": [], "edges": []},
        )

    
def serialise_graph(graph: nx.DiGraph) -> dict[str, object]:
    return {
        "directed": True,
        "nodes": sorted(({"id": node} for node in graph.nodes), key=lambda item: item["id"]),
        "edges": [
            {
                "source": source,
                "target": target,
                "weight": data.get("weight", 1),
                "imports": data.get("imports", []),
                "files": sorted({item["file"] for item in data.get("imports", [])}),
            }
            for source, target, data in sorted(graph.edges(data=True))
        ],
    }