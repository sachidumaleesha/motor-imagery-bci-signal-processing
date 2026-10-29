# Corrected Motor Imagery BCI practical

Open **bci_lab4_solution.ipynb** for the standalone notebook, including explanations,
figures and execution outputs. The original notebook in Downloads is unchanged.

## Run in Colab or Jupyter

1. Open/upload `bci_lab4_solution.ipynb`.
2. In a fresh environment, uncomment its `%pip install` line. For exact local
   reproduction, install `requirements.txt` instead.
3. Run every cell in order. Five public EDF recordings from PhysioNet are downloaded
   to `data/`. No GPU is needed.
4. Figures, metrics and full streaming timing logs are saved in `results/`.

## Run locally from the repository root

```powershell
.\.venv-bci\Scripts\python.exe -m pip install -r assignment\requirements.txt
.\.venv-bci\Scripts\python.exe assignment\execute_notebook.py
```

`bci_lab4_solution.py` is the reviewable percent-format source. After editing that
source, run `assignment/build_notebook.py` with the same Python interpreter to
regenerate the notebook, then execute it. Regeneration clears previous outputs.
The notebook embeds all analysis code and does not need the source file to run.

## Design decisions

- Subject 1 baseline runs 1/2 calibrate ICA independently of model evaluation.
- Subject 1 imagery runs 8/12 supply enough trials for stratified ten-fold CV.
- Subject 1 run 4 is reserved for the revised streaming test. It was inspected in
  the original work, so it is not represented as a never-before-seen dataset.
- A documented 16-channel subset includes Fp1/Fp2 and C3/Cz/C4.
- CSP, scaling and classifiers are fitted inside validation folds. SVM grid search
  is nested. A separate leave-one-run-out check exposes session sensitivity.
- Broadband four-component classification follows the manual's example. Separate
  descriptive mu/4, beta/4 and broadband/6 analyses cover its parameter table.
- Stateful causal filtering and the fixed ICA projection are used in training and
  streaming. The online model is trained on 500 ms windows rather than four-second
  epochs. Held-out run evaluation keeps overlapping windows out of training.
- Simulated queue-overflow accounting is separate from hardware acquisition. ITR
  uses one aggregated command per trial with rest included in the command interval.

## Interpretation and remaining submission work

Actual performance is printed in the last cell and `results/summary.json`. A target
may remain unmet despite correct code; never change scores or select test results
to make it pass. In particular, the dataset has no clean EEG reference, so true
SNR improvement cannot be established. The notebook reports a labelled frontal
low-frequency attenuation proxy and before/after plots instead. Fp1/Fp2 are EEG
proxies, not dedicated EOG sensors; component interpretation still matters.

The assignment's two-page report and final `[Student_ID]_BCI_Lab4.zip` are separate
submission deliverables. Use the verified notebook results to write the report and
explain the SNR limitation, channel selection, calibration split and any missed
performance targets. The report should discuss C3/C4 pattern localization, the
observed alpha power changes, and measured latency rather than assume success.
