
import ast
from dataclasses import dataclass
from typing import Iterable

@dataclass(frozen=True)
class PythonFile:
    path: str
    source: str
    module: str
    unit: str

@dataclass(frozen=True)
class DependencyEdge:
    source: str
    target: str
    import_name: str

class DependencyExtractor:
    def __init__(self, package_depth: int = 1) -> None:
        if package_depth < 1:
            raise ValueError("package_depth must be >= 1")
        self.package_depth = package_depth
    
    def python_file(self, path: str, source: str) -> PythonFile | None:
        module = module_name_from_file_path(path)
        if module:
            return PythonFile(
                path=path,
                source=source,
                module=module,
                unit=unit_from_module(module, self.package_depth),
            )
        return None 
    
    # parses files, finds imports, and creates edges to imports of other modules
    def extract(self, files: Iterable[PythonFile]) -> list[DependencyEdge]:
        python_files = list(files)
        internal_modules = {file.module for file in python_files}
        internal_units = {file.unit for file in python_files}
        edges: list[DependencyEdge] = []

        for file in python_files:
            for import_name in self._imports_for_file(file):
                target_unit = self._resolve_internal_unit(
                    import_name=import_name,
                    source_module=file.module,
                    internal_modules=internal_modules,
                    internal_units=internal_units,
                )
                if target_unit and target_unit != file.unit:
                    edges.append(
                        DependencyEdge(
                            source=file.unit,
                            target=target_unit,
                            import_name=import_name,
                        )
                    )

        return edges
    
    # Extract imports from eatch file.
    def _imports_for_file(self, file: PythonFile) -> set[str]:
        try:
            tree = ast.parse(file.source, filename=file.path)
        except SyntaxError:
            return set()

        imports: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imports.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                imports.add(resolve_import_from(file.module, node))
        return {name for name in imports if name}
    
    # checks if import is part of the same module (grouping)
    def _resolve_internal_unit(
        self,
        *,
        import_name: str,
        source_module: str,
        internal_modules: set[str],
        internal_units: set[str],
    ) -> str | None:
        candidates = import_name.split(".")
        while candidates:
            candidate = ".".join(candidates)
            unit = unit_from_module(candidate, self.package_depth)
            if candidate in internal_modules or unit in internal_units:
                return unit
            candidates.pop()

        source_root = unit_from_module(source_module, self.package_depth)
        imported_root = unit_from_module(import_name, self.package_depth)
        if imported_root == source_root and imported_root in internal_units:
            return imported_root
        return None

def resolve_import_from(source_module: str, node: ast.ImportFrom) -> str:
    module = node.module or ""
    if node.level == 0:
        return module

    parts = source_module.split(".")
    package_parts = parts[:-1]
    keep = max(len(package_parts) - node.level + 1, 0)
    base = package_parts[:keep]
    if module:
        base.extend(module.split("."))
    return ".".join(part for part in base if part)

# Modified from Google Colab (Lecture 1) - Originally written by Mircea Lungu
def module_name_from_file_path(full_path):

    file_name = full_path.replace("/__init__.py", "")
    file_name = file_name.replace("/", ".")
    file_name = file_name.replace(".py", "")
    return file_name.lstrip(".")

# Converts a module name to unit based on depth
def unit_from_module(module: str, depth: int = 1) -> str:
    return ".".join(module.split(".")[:depth])