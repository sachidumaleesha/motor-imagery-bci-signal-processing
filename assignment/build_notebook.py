"""Convert the reviewable percent-format source into a standalone notebook."""
from pathlib import Path
import re
import nbformat

root = Path(__file__).resolve().parent
source = (root / "bci_lab4_solution.py").read_text(encoding="utf-8")
cells = []
for block in re.split(r"(?m)^# %%", source)[1:]:
    heading, _, body = block.partition("\n")
    if "[markdown]" in heading:
        body = "\n".join(line[2:] if line.startswith("# ") else line[1:] if line == "#" else line for line in body.splitlines())
        cells.append(nbformat.v4.new_markdown_cell(body.strip()))
    else:
        cells.append(nbformat.v4.new_code_cell(body.strip()))
notebook = nbformat.v4.new_notebook(cells=cells)
notebook.metadata.kernelspec = {"display_name": "Python 3", "language": "python", "name": "python3"}
notebook.metadata.language_info = {"name": "python", "version": "3.12"}
nbformat.validate(notebook)
target = root / "bci_lab4_solution.ipynb"
nbformat.write(notebook, target)
print(f"Created {target} with {len(cells)} cells")
