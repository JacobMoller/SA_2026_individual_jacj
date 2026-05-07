
from dataclasses import dataclass

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
        print(f"Extracted module name '{module}' from path '{path}'")
        if module:
            return PythonFile(
                path=path,
                source=source,
                module=module,
                unit=unit_from_module(module, self.package_depth),
            )
        return None 


# Modified from Google Colab (Lecture 1) - Originally written by Mircea Lungu
def module_name_from_file_path(full_path):

    file_name = full_path.replace("/__init__.py", "")
    file_name = file_name.replace("/", ".")
    file_name = file_name.replace(".py", "")
    return file_name.lstrip(".")

# Converts a module name to unit based on depth
def unit_from_module(module: str, depth: int = 1) -> str:
    return ".".join(module.split(".")[:depth])