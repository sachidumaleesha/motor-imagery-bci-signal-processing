"""Execute the notebook with this interpreter and retain outputs on failure."""
from pathlib import Path
import os
import sys
import nbformat
from nbclient import NotebookClient
from jupyter_client import KernelManager

root = Path(__file__).resolve().parent
for name in ["runtime", "ipython", "matplotlib"]:
    (root / ".jupyter" / name).mkdir(parents=True, exist_ok=True)
os.environ["JUPYTER_RUNTIME_DIR"] = str(root / ".jupyter" / "runtime")
os.environ["IPYTHONDIR"] = str(root / ".jupyter" / "ipython")
os.environ["MPLCONFIGDIR"] = str(root / ".jupyter" / "matplotlib")
os.environ["MNE_DONTWRITE_HOME"] = "true"
path = root / "bci_lab4_solution.ipynb"
notebook = nbformat.read(path, as_version=4)
manager = KernelManager(kernel_name="python3")
manager.kernel_spec.argv = [sys.executable, "-m", "ipykernel_launcher", "-f", "{connection_file}"]
client = NotebookClient(notebook, km=manager, timeout=900, resources={"metadata": {"path": str(root)}})

def progress(cell, cell_index, **kwargs):
    print(f"Executing cell {cell_index}: {cell.source.splitlines()[0][:100]}", flush=True)

client.on_cell_start = progress
def checkpoint(cell, cell_index, **kwargs):
    nbformat.write(notebook, path)

client.on_cell_executed = checkpoint
try:
    client.execute()
finally:
    nbformat.write(notebook, path)
print(f"Executed and saved {path}")
