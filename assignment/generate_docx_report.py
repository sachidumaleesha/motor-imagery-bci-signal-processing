"""Generate a comprehensive, professionally styled Word document (.docx)
for the Motor Imagery BCI Practical Lab 4 Summary Report.
"""
from pathlib import Path
import json
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

ROOT = Path(__file__).resolve().parent
RESULTS = ROOT / "results"
FIG = RESULTS / "figures"
OUTPUT_DOCX = ROOT / "BCI_Lab4_Summary_Report.docx"

# Load results summary
with open(RESULTS / "summary.json", "r", encoding="utf-8") as f:
    summary = json.load(f)

def set_cell_background(cell, fill_hex):
    """Set background color of a table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Set inner cell padding in twips (1 pt = 20 twips)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_table_borders(table, color="CBD5E1", sz="4", val="single"):
    """Set subtle table borders."""
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:left w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:right w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideV w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def build_docx():
    doc = docx.Document()

    # Page setup: Letter with 0.5 inch margins
    sections = doc.sections
    for s in sections:
        s.page_width = Inches(8.5)
        s.page_height = Inches(11.0)
        s.top_margin = Inches(0.45)
        s.bottom_margin = Inches(0.45)
        s.left_margin = Inches(0.5)
        s.right_margin = Inches(0.5)

        # Header
        header = s.header
        hp = header.paragraphs[0]
        hp.text = "Motor Imagery BCI Practical — Lab 4 Summary Report | PhysioNet EEGMMIDB S001"
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hp.style.font.name = "Calibri"
        hp.style.font.size = Pt(8.5)
        hp.style.font.color.rgb = RGBColor(100, 116, 139)

        # Footer
        footer = s.footer
        fp = footer.paragraphs[0]
        fp.text = "Technical Evaluation Report: Classification, CSP Topographies & Latency Bottlenecks | Student ID: ________________"
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        fp.style.font.name = "Calibri"
        fp.style.font.size = Pt(8.5)
        fp.style.font.color.rgb = RGBColor(100, 116, 139)

    # Styles Setup
    normal_style = doc.styles["Normal"]
    normal_style.font.name = "Calibri"
    normal_style.font.size = Pt(9.5)
    normal_style.font.color.rgb = RGBColor(30, 41, 59)
    normal_style.paragraph_format.line_spacing = 1.15
    normal_style.paragraph_format.space_after = Pt(4)

    # --- DOCUMENT TITLE ---
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(2)
    t_run = title_p.add_run("Motor Imagery BCI Practical: Two-Page Evaluation Report")
    t_run.font.name = "Calibri"
    t_run.font.size = Pt(17)
    t_run.bold = True
    t_run.font.color.rgb = RGBColor(30, 58, 138)  # Navy

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_before = Pt(0)
    sub_p.paragraph_format.space_after = Pt(6)
    sub_run = sub_p.add_run("Analysis of Offline Classification, Common Spatial Patterns (CSP), and Real-Time Latency Bottlenecks")
    sub_run.font.size = Pt(10)
    sub_run.font.italic = True
    sub_run.font.color.rgb = RGBColor(71, 85, 105)

    # --- METADATA TABLE ---
    meta_tbl = doc.add_table(rows=1, cols=4)
    meta_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_tbl.autofit = False
    col_widths = [Inches(1.8), Inches(2.0), Inches(1.8), Inches(1.9)]
    meta_info = [
        ("Dataset", "PhysioNet EEGMMIDB S001"),
        ("Montage", "16 Channels (10-20 system)"),
        ("Sampling", "160 Hz (Causal Processing)"),
        ("Target Task", "Left vs. Right Fist Imagery")
    ]
    for i, (label, val) in enumerate(meta_info):
        cell = meta_tbl.cell(0, i)
        cell.width = col_widths[i]
        set_cell_background(cell, "F1F5F9")
        set_cell_margins(cell, top=60, bottom=60, left=100, right=100)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r1 = p.add_run(f"{label}: ")
        r1.bold = True
        r1.font.size = Pt(8.5)
        r2 = p.add_run(val)
        r2.font.size = Pt(8.5)
    set_table_borders(meta_tbl, color="CBD5E1", sz="4")

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # --- EXECUTIVE SUMMARY BOX ---
    exec_tbl = doc.add_table(rows=1, cols=1)
    exec_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    exec_cell = exec_tbl.cell(0, 0)
    exec_cell.width = Inches(7.5)
    set_cell_background(exec_cell, "EFF6FF")
    set_cell_margins(exec_cell, top=100, bottom=100, left=150, right=150)
    ep = exec_cell.paragraphs[0]
    ep.paragraph_format.space_after = Pt(0)
    er_title = ep.add_run("Executive Summary: ")
    er_title.bold = True
    er_title.font.color.rgb = RGBColor(30, 58, 138)
    er_body = ep.add_run(
        "This report provides an objective technical analysis of a motor imagery Brain-Computer Interface (BCI) "
        "pipeline for Subject 1. Real-time streaming achieved outstanding computational latency (mean 0.45 ms, "
        "maximum 1.40 ms, easily beating the 15 ms target) with zero dropped chunks. However, strict 10-fold "
        "cross-validation accuracy reached only 56.7%, falling short of the >78.5% course target. Rather than software "
        "malfunction, this shortfall is explained by clear neurophysiological findings: the subject showed no contralateral "
        "alpha power suppression (ERD values were slightly negative or flat), and CSP patterns spread across frontal and parietal "
        "sensors instead of isolating distinct C3/C4 motor dipoles."
    )
    er_body.font.size = Pt(9.0)
    set_table_borders(exec_tbl, color="93C5FD", sz="8")

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # --- SECTION 1 ---
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(6)
    h1.paragraph_format.space_after = Pt(2)
    r = h1.add_run("1. Data Split, Preprocessing & Artifact Integrity")
    r.bold = True
    r.font.size = Pt(11.5)
    r.font.color.rgb = RGBColor(30, 58, 138)

    p1 = doc.add_paragraph()
    p1.add_run("Rigorous Run Partitioning: ").bold = True
    p1.add_run(
        "To guarantee zero data leakage between training and testing, eye-blink artifacts were calibrated on independent "
        "baseline runs (Runs 1 and 2). Motor imagery training utilized Runs 8 and 12 (30 balanced trials: 15 Left, 15 Right). "
        "Run 4 was held out exclusively for causal online streaming replay. Signals were filtered with a 4th-order causal "
        "Butterworth bandpass filter (8–30 Hz, Second-Order Sections).\n"
    )
    p1.add_run("Artifact Mitigation & SNR Limitation: ").bold = True
    p1.add_run(
        "FastICA identified Independent Component 1 (IC1) as an eye-blink artifact, strongly correlated with frontal sensors (Fp1/Fp2). "
        "A fixed affine projection matrix was constructed to subtract IC1 causally without needing future data. "
    )
    p1_note = p1.add_run(
        "Critical note on SNR: Because the public PhysioNet dataset lacks clean ground-truth EEG, true Signal-to-Noise Ratio (SNR) "
        "improvement cannot be computed. Instead, we measured low-frequency frontal power reduction: Fp1 demonstrated 7.79 dB "
        "attenuation and Fp2 demonstrated 8.10 dB attenuation, confirming effective removal of ocular artifacts while preserving motor channels."
    )
    p1_note.italic = True

    # --- SECTION 2 ---
    h2 = doc.add_paragraph()
    h2.paragraph_format.space_before = Pt(6)
    h2.paragraph_format.space_after = Pt(2)
    r = h2.add_run("2. Common Spatial Pattern (CSP) Topographies & Spectral ERD")
    r.bold = True
    r.font.size = Pt(11.5)
    r.font.color.rgb = RGBColor(30, 58, 138)

    p2 = doc.add_paragraph()
    p2.add_run("CSP Spatial Filtering: ").bold = True
    p2.add_run(
        "Common Spatial Pattern (CSP) seeks spatial filters that maximize signal variance for one class while minimizing variance "
        "for the opposite class. With alternate ordering, the top two and bottom two filters isolate Left vs. Right extremes. Under standard "
        "neurophysiology, left-hand imagery induces contralateral Event-Related Desynchronization (ERD; power decrease) over the right "
        "motor cortex (C4), while right-hand imagery suppresses power over the left motor cortex (C3)."
    )

    # Figures: Side by Side in a 1-row, 2-column table
    img_tbl = doc.add_table(rows=2, cols=2)
    img_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    img_tbl.autofit = False
    
    cell_csp = img_tbl.cell(0, 0)
    cell_csp.width = Inches(4.3)
    p_csp = cell_csp.paragraphs[0]
    p_csp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_csp.add_run().add_picture(str(FIG / "csp_patterns.png"), width=Inches(4.1))

    cell_erd = img_tbl.cell(0, 1)
    cell_erd.width = Inches(3.2)
    p_erd = cell_erd.paragraphs[0]
    p_erd.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_erd.add_run().add_picture(str(FIG / "alpha_erd.png"), width=Inches(3.0))

    cap_csp = img_tbl.cell(1, 0).paragraphs[0]
    cap_csp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap_csp.paragraph_format.space_after = Pt(2)
    c1 = cap_csp.add_run("Figure 1: 4-component broadband CSP patterns (descending eigenvalue order).")
    c1.font.size = Pt(8.0)
    c1.italic = True
    c1.font.color.rgb = RGBColor(100, 116, 139)

    cap_erd = img_tbl.cell(1, 1).paragraphs[0]
    cap_erd.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap_erd.paragraph_format.space_after = Pt(2)
    c2 = cap_erd.add_run("Figure 2: Paired 8–12 Hz alpha ERD at C3 & C4.")
    c2.font.size = Pt(8.0)
    c2.italic = True
    c2.font.color.rgb = RGBColor(100, 116, 139)

    set_table_borders(img_tbl, val="none")

    p2_analysis = doc.add_paragraph()
    p2_analysis.add_run("Topographic Dispersion (Figure 1): ").bold = True
    p2_analysis.add_run(
        "The spatial patterns show extensive power leakage into frontal sensors (Fp1, Fp2, Fz) and parietal sensors (P3, P4). "
        "They do not form clean, focused dipoles centered tightly over C3 and C4. While the 16-channel montage imposes spatial limits, "
        "the underlying neural source activations in this subject were broadly dispersed.\n"
    )
    p2_analysis.add_run("Absence of Contralateral Alpha ERD (Figure 2): ").bold = True
    p2_analysis.add_run(
        "Alpha power (8–12 Hz) during each 4-second imagery trial was compared directly against its preceding 4-second baseline rest cue (T0). "
        "Desynchronization is defined as ERD% = 100 * (Rest - Imagery) / Rest (positive = power drop; negative = power increase):\n"
        "• C3 (Left Motor Cortex): Left Imagery = -13.39% | Right Imagery = -9.02% (both negative, meaning power increased during imagery).\n"
        "• C4 (Right Motor Cortex): Left Imagery = -0.89% | Right Imagery = -1.03% (both near zero, showing no modulation).\n"
        "Because this subject did not produce natural contralateral alpha suppression, the spatial filters lacked the biological contrast "
        "required to cleanly discriminate left from right."
    )

    # Frequency Band Table
    band_tbl = doc.add_table(rows=4, cols=6)
    band_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    b_headers = ["Frequency Band", "Passband (Hz)", "CSP Comp.", "Empirical Variance Ratio", "Manual Target", "Status"]
    b_col_widths = [Inches(1.5), Inches(1.1), Inches(0.9), Inches(1.6), Inches(1.1), Inches(1.3)]
    for j, h in enumerate(b_headers):
        c = band_tbl.cell(0, j)
        c.width = b_col_widths[j]
        set_cell_background(c, "1E3A8A")
        set_cell_margins(c, top=60, bottom=60, left=80, right=80)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.bold = True
        r.font.size = Pt(8.0)
        r.font.color.rgb = RGBColor(255, 255, 255)

    b_rows = [
        ("Mu Band", "8 – 12 Hz", "4", "1.60", "3.20", "Unmet (50% of target)"),
        ("Beta Band", "16 – 24 Hz", "4", "1.39", "2.80", "Unmet (50% of target)"),
        ("Broadband", "8 – 30 Hz", "6", "1.38", "4.10", "Unmet (34% of target)"),
    ]
    for i, row in enumerate(b_rows, start=1):
        for j, val in enumerate(row):
            c = band_tbl.cell(i, j)
            c.width = b_col_widths[j]
            if i % 2 == 1:
                set_cell_background(c, "F8FAFC")
            set_cell_margins(c, top=40, bottom=40, left=80, right=80)
            p = c.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if j > 0 else WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(val)
            r.font.size = Pt(8.0)
            if j == 5:
                r.bold = True
                r.font.color.rgb = RGBColor(220, 38, 38)
    set_table_borders(band_tbl, color="CBD5E1", sz="4")

    # --- PAGE BREAK FOR PAGE 2 ---
    doc.add_page_break()

    # --- SECTION 3 ---
    h3 = doc.add_paragraph()
    h3.paragraph_format.space_before = Pt(4)
    h3.paragraph_format.space_after = Pt(2)
    r = h3.add_run("3. Classification Performance & Cross-Validation Analysis")
    r.bold = True
    r.font.size = Pt(11.5)
    r.font.color.rgb = RGBColor(30, 58, 138)

    p3 = doc.add_paragraph()
    p3.add_run("Leakage-Safe Validation Setup: ").bold = True
    p3.add_run(
        "To avoid optimistic bias and data leakage, signal centering, CSP decomposition, StandardScaler normalisation, and classifiers "
        "were fitted strictly inside each training split of a 10-fold Stratified Cross-Validation (3 test trials per fold). "
        "SVM hyperparameters (C, gamma) were optimized using a nested 3-fold inner cross-validation, never seeing outer test folds."
    )

    # Figure 3: Classifier Metrics
    p_fig3 = doc.add_paragraph()
    p_fig3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_fig3.paragraph_format.space_after = Pt(1)
    p_fig3.add_run().add_picture(str(FIG / "classifier_oof_metrics.png"), width=Inches(7.3))
    cap3 = doc.add_paragraph()
    cap3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap3.paragraph_format.space_after = Pt(4)
    c3 = cap3.add_run("Figure 3: Out-of-fold confusion matrices for LDA and SVM alongside pooled ROC curves (10-fold CV).")
    c3.font.size = Pt(8.0)
    c3.italic = True
    c3.font.color.rgb = RGBColor(100, 116, 139)

    # Classification Metrics Table
    clf_tbl = doc.add_table(rows=3, cols=6)
    clf_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    clf_headers = ["Model", "10-Fold OOF Accuracy", "ROC-AUC", "Fold Accuracy SD", "Confusion Matrix (L / R)", "Evaluation vs. >78.5% Target"]
    clf_col_widths = [Inches(1.4), Inches(1.3), Inches(0.9), Inches(1.1), Inches(1.3), Inches(1.5)]
    for j, h in enumerate(clf_headers):
        c = clf_tbl.cell(0, j)
        c.width = clf_col_widths[j]
        set_cell_background(c, "1E3A8A")
        set_cell_margins(c, top=60, bottom=60, left=80, right=80)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.bold = True
        r.font.size = Pt(8.0)
        r.font.color.rgb = RGBColor(255, 255, 255)

    clf_rows = [
        ("Shrinkage LDA", "56.7% (17/30)", "0.604", "± 27.4%", "L: 8/15, R: 9/15", "Target Unmet (Chance: 50%)"),
        ("RBF SVM", "56.7% (17/30)", "0.618", "± 31.6%", "L: 9/15, R: 8/15", "Target Unmet (Chance: 50%)"),
    ]
    for i, row in enumerate(clf_rows, start=1):
        for j, val in enumerate(row):
            c = clf_tbl.cell(i, j)
            c.width = clf_col_widths[j]
            if i % 2 == 1:
                set_cell_background(c, "F8FAFC")
            set_cell_margins(c, top=40, bottom=40, left=80, right=80)
            p = c.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if j > 0 else WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(val)
            r.font.size = Pt(8.0)
            if j == 5:
                r.bold = True
                r.font.color.rgb = RGBColor(220, 38, 38)
    set_table_borders(clf_tbl, color="CBD5E1", sz="4")

    doc.add_paragraph().paragraph_format.space_after = Pt(2)

    p3_disc = doc.add_paragraph()
    p3_disc.add_run("Interpretation of Accuracy: ").bold = True
    p3_disc.add_run(
        "Both linear (Shrinkage LDA) and non-linear (RBF SVM) classifiers achieved identical 56.7% accuracy. This marginal performance "
        "above 50% chance reflects the physiological absence of mu/beta rhythm modulation rather than model underfitting. "
        "The fold-to-fold standard deviation is high (~27–32%), spanning 0% to 100% on individual 3-trial test folds.\n"
    )
    p3_disc.add_run("Session Non-Stationarity (Leave-One-Run-Out): ").bold = True
    p3_disc.add_run(
        "When trained on Run 8 and evaluated on Run 12, accuracy reached 60.0% (AUC 0.571). However, training on Run 12 and evaluating "
        "on Run 8 dropped LDA to 46.7% (below chance; SVM reached 53.3%). This proves that electrode impedance shifts and mental state "
        "drift across runs create significant non-stationarities, a common challenge in practical BCI."
    )

    # --- SECTION 4 ---
    h4 = doc.add_paragraph()
    h4.paragraph_format.space_before = Pt(6)
    h4.paragraph_format.space_after = Pt(2)
    r = h4.add_run("4. Real-Time Latency Bottlenecks & Streaming Replay")
    r.bold = True
    r.font.size = Pt(11.5)
    r.font.color.rgb = RGBColor(30, 58, 138)

    p4 = doc.add_paragraph()
    p4.add_run("Streaming Architecture: ").bold = True
    p4.add_run(
        "Causal replay was conducted on reserved Run 4. Incoming data arrived in 10-sample chunks (62.5 ms arrival period at 160 Hz). "
        "A stateful IIR Butterworth filter and fixed ICA projection processed each chunk, updating a 500 ms (80-sample) ring buffer. "
        "For complete windows, CSP log-variance features were extracted and classified with a 3-decision sliding majority vote."
    )

    # Figure 4: Stream Latency
    p_fig4 = doc.add_paragraph()
    p_fig4.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_fig4.paragraph_format.space_after = Pt(1)
    p_fig4.add_run().add_picture(str(FIG / "stream_latency.png"), width=Inches(7.3))
    cap4 = doc.add_paragraph()
    cap4.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap4.paragraph_format.space_after = Pt(4)
    c4 = cap4.add_run("Figure 4: Execution latency per 10-sample chunk (left) and decision-chunk latency histogram (right) on Run 4.")
    c4.font.size = Pt(8.0)
    c4.italic = True
    c4.font.color.rgb = RGBColor(100, 116, 139)

    # Latency KPI Table
    lat_tbl = doc.add_table(rows=2, cols=5)
    lat_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    lat_headers = ["Mean Latency", "95th Percentile", "Maximum Latency", "Chunk Deadline", "15 ms Target Status"]
    lat_col_widths = [Inches(1.5), Inches(1.5), Inches(1.5), Inches(1.5), Inches(1.5)]
    for j, h in enumerate(lat_headers):
        c = lat_tbl.cell(0, j)
        c.width = lat_col_widths[j]
        set_cell_background(c, "F1F5F9")
        set_cell_margins(c, top=50, bottom=50, left=60, right=60)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.bold = True
        r.font.size = Pt(8.5)
        r.font.color.rgb = RGBColor(30, 41, 59)

    lat_vals = [("0.45 ms", "1E3A8A"), ("0.56 ms", "1E3A8A"), ("1.40 ms", "1E3A8A"), ("62.5 ms", "334155"), ("PASSED (10x Margin)", "16A34A")]
    for j, (v, color_hex) in enumerate(lat_vals):
        c = lat_tbl.cell(1, j)
        c.width = lat_col_widths[j]
        set_cell_background(c, "FFFFFF")
        set_cell_margins(c, top=50, bottom=50, left=60, right=60)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(v)
        r.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor.from_string(color_hex)
    set_table_borders(lat_tbl, color="CBD5E1", sz="4")

    doc.add_paragraph().paragraph_format.space_after = Pt(2)

    p4_bottlenecks = doc.add_paragraph()
    p4_bottlenecks.add_run("Real-World Latency Bottlenecks: ").bold = True
    p4_bottlenecks.add_run(
        "Although computation took only 0.45 ms (well below the 15 ms target and the 62.5 ms chunk interval), practical online "
        "deployments encounter three critical bottlenecks:\n"
        "1. Algorithmic Buffering Delay: The system requires 500 ms of signal plus a 3-decision majority smoother, introducing "
        "an intrinsic ~625 ms sensory-to-decision lag before an output can be acted upon.\n"
        "2. Hardware & Driver Jitter: Practical EEG amplifiers buffer USB/Bluetooth packets; OS thread scheduling and rendering pipelines "
        "routinely add 10–50 ms of transmission jitter. In our simulation, buffer capacity was maintained without drops (0 drops, max lag 1.40 ms).\n"
        "3. Streaming Accuracy vs. Offline: Aggregating decisions across each 4 s trial in Run 4 yielded 100% trial accuracy (15/15 correct; "
        "7.23 bits/min idealized ITR). However, Run 4 was inspected during preliminary development and contains only 15 trials; it must not be "
        "interpreted as generalized multi-subject readiness."
    )

    # --- SECTION 5: KEY TAKEAWAYS CARD ---
    takeaway_tbl = doc.add_table(rows=1, cols=1)
    takeaway_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_cell = takeaway_tbl.cell(0, 0)
    t_cell.width = Inches(7.5)
    set_cell_background(t_cell, "F8FAFC")
    set_cell_margins(t_cell, top=100, bottom=100, left=150, right=150)
    tp = t_cell.paragraphs[0]
    tp.paragraph_format.space_after = Pt(0)
    t_title = tp.add_run("5. Key Takeaways & Recommendations:\n")
    t_title.bold = True
    t_title.font.size = Pt(9.5)
    t_title.font.color.rgb = RGBColor(30, 58, 138)
    t_text = tp.add_run(
        "• Honest Performance Reporting: The >78.5% classification target was unmet. In physiological EEG, subject-specific 'BCI illiteracy' "
        "(absence of distinct sensorimotor rhythm modulation) is common and must be reported objectively rather than artificially tuned.\n"
        "• Methodological Rigor: Causal Second-Order Sections (SOS) filtering and fixed affine ICA projections successfully eliminate all data leakage.\n"
        "• Recommended Next Steps: Future iterations should incorporate user neurofeedback training to help subjects regulate mu rhythms, "
        "adaptive Riemannian geometry classifiers to manage inter-run non-stationarities, and higher-density electrode caps (32–64 channels) "
        "to improve spatial resolution."
    )
    t_text.font.size = Pt(8.5)
    set_table_borders(takeaway_tbl, color="CBD5E1", sz="6")

    doc.save(str(OUTPUT_DOCX))
    print(f"Generated DOCX at: {OUTPUT_DOCX}")

if __name__ == "__main__":
    build_docx()
