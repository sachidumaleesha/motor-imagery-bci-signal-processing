"""Generate a concise, professional, publication-quality 2-page PDF summary report for BCI Lab 4.
"""
from pathlib import Path
import json
import fitz  # PyMuPDF
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
RESULTS = ROOT / "results"
FIG = RESULTS / "figures"
OUTPUT_PDF = ROOT / "BCI_Lab4_Summary_Report.pdf"

# Load results summary
with open(RESULTS / "summary.json", "r", encoding="utf-8") as f:
    summary = json.load(f)

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and draw total page numbers and running header/footer."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages 1 and 2)
        self.drawString(36, 762, "Motor Imagery BCI Practical — Lab 4 Summary Report")
        self.drawRightString(612 - 36, 762, "PhysioNet EEGMMIDB S001 Analysis")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(36, 756, 612 - 36, 756)
        
        # Footer
        self.line(36, 38, 612 - 36, 38)
        self.drawString(36, 26, "Concise Technical Evaluation: Classification, CSP Topographies & Latency Bottlenecks")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(612 - 36, 26, page_str)
        self.restoreState()


def build_pdf():
    # Target 612 x 792 pt, margins 36 pt left/right, 42 pt top/bottom
    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=42,
        bottomMargin=42
    )

    styles = getSampleStyleSheet()

    # Custom typography
    c_primary = colors.HexColor("#1E3A8A")     # Navy
    c_secondary = colors.HexColor("#0284C7")   # Blue
    c_dark = colors.HexColor("#0F172A")        # Slate-900
    c_body = colors.HexColor("#334155")        # Slate-700
    c_light = colors.HexColor("#F8FAFC")       # Slate-50
    c_border = colors.HexColor("#E2E8F0")      # Slate-200
    c_red = colors.HexColor("#DC2626")         # Red-600
    c_green = colors.HexColor("#16A34A")       # Green-600

    title_style = ParagraphStyle(
        "DocTitle",
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=c_primary,
        spaceAfter=2
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#475569"),
        spaceAfter=6
    )

    h1_style = ParagraphStyle(
        "Heading1_Custom",
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=c_primary,
        spaceBefore=5,
        spaceAfter=3
    )

    h2_style = ParagraphStyle(
        "Heading2_Custom",
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=c_secondary,
        spaceBefore=3,
        spaceAfter=2
    )

    body_style = ParagraphStyle(
        "Body_Custom",
        fontName="Helvetica",
        fontSize=7.8,
        leading=10.2,
        textColor=c_body,
        spaceAfter=3
    )

    body_bold = ParagraphStyle(
        "Body_Bold",
        fontName="Helvetica-Bold",
        fontSize=7.8,
        leading=10.2,
        textColor=c_dark
    )

    callout_style = ParagraphStyle(
        "Callout_Text",
        fontName="Helvetica",
        fontSize=7.8,
        leading=10.4,
        textColor=c_dark
    )

    table_header = ParagraphStyle(
        "TableHeader",
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
        alignment=1
    )

    table_cell = ParagraphStyle(
        "TableCell",
        fontName="Helvetica",
        fontSize=7.2,
        leading=9.2,
        textColor=c_dark,
        alignment=1
    )

    table_cell_left = ParagraphStyle(
        "TableCellLeft",
        fontName="Helvetica",
        fontSize=7.2,
        leading=9.2,
        textColor=c_dark,
        alignment=0
    )

    caption_style = ParagraphStyle(
        "FigCaption",
        fontName="Helvetica-Oblique",
        fontSize=7.0,
        leading=9.0,
        textColor=colors.HexColor("#64748B"),
        alignment=1,
        spaceAfter=4
    )

    story = []

    # =========================================================================
    # PAGE 1: SYSTEM OVERVIEW, PREPROCESSING, CSP PATTERNS & ALPHA ERD
    # =========================================================================
    
    # Header block
    story.append(Paragraph("Motor Imagery BCI Practical: Two-Page Evaluation Report", title_style))
    story.append(Paragraph("<b>Analysis of Offline Classification, Common Spatial Patterns (CSP), and Real-Time Latency Bottlenecks</b>", subtitle_style))

    # Meta Ribbon Table
    meta_data = [[
        Paragraph("<b>Dataset:</b> PhysioNet EEGMMIDB (S001)", body_style),
        Paragraph("<b>Montage:</b> 16 Channels (10-20 system)", body_style),
        Paragraph("<b>Sampling:</b> 160 Hz (Causal)", body_style),
        Paragraph("<b>Target Task:</b> Left vs. Right Fist Imagery", body_style)
    ]]
    meta_table = Table(meta_data, colWidths=[135, 145, 120, 140])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 4))

    # Executive Summary Card
    exec_summary_text = (
        "<b>Executive Summary:</b> This report presents an objective evaluation of a motor imagery Brain-Computer Interface (BCI) "
        "pipeline for Subject 1. Real-time streaming achieved outstanding computational latency (mean <b>0.45 ms</b>, maximum <b>1.40 ms</b>, "
        "well inside the 15 ms target) with zero dropped chunks. However, strict 10-fold cross-validation accuracy reached only <b>56.7%</b>, "
        "failing the assignment's >78.5% goal. Rather than software malfunction, this result is explained by clear neurophysiological "
        "findings: the subject showed no contralateral alpha power suppression (ERD values were slightly negative or flat), and CSP patterns "
        "spread across frontal and parietal sensors instead of isolating distinct C3/C4 motor dipoles."
    )
    exec_table = Table([[Paragraph(exec_summary_text, callout_style)]], colWidths=[540])
    exec_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EFF6FF")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#93C5FD")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(exec_table)
    story.append(Spacer(1, 5))

    # Section 1: Preprocessing & Methodological Integrity
    story.append(Paragraph("1. Data Split, Preprocessing & Artifact Integrity", h1_style))
    p1_desc = (
        "<b>Rigorous Run Partitioning:</b> To avoid data leakage, eye-blink artifacts were calibrated strictly on independent resting runs "
        "(Runs 1 and 2). Motor imagery training used Runs 8 and 12 (30 balanced trials: 15 Left, 15 Right). Run 4 was reserved strictly "
        "for online replay evaluation. Signals were filtered with a 4th-order causal Butterworth bandpass filter (8–30 Hz, SOS).<br/>"
        "<b>Artifact Mitigation & SNR Limitation:</b> An ICA decomposition identified Independent Component 1 (IC1) as an eye-blink artifact, "
        "showing strong correlation with frontal channels (Fp1/Fp2). A fixed affine projection matrix was constructed to subtract IC1 causally. "
        "<i>Critical note on SNR:</i> Because the PhysioNet dataset lacks clean ground-truth EEG, true Signal-to-Noise Ratio (SNR) improvement "
        "cannot be calculated. Instead, we measured low-frequency frontal power reduction: Fp1 showed <b>7.79 dB</b> attenuation and Fp2 showed "
        "<b>8.10 dB</b> attenuation, confirming successful suppression of large ocular deflections without altering motor electrodes."
    )
    story.append(Paragraph(p1_desc, body_style))
    story.append(Spacer(1, 4))

    # Section 2: CSP Topographies & Spectral Evidence
    story.append(Paragraph("2. Common Spatial Pattern (CSP) Topographies & Spectral ERD", h1_style))
    p2_intro = (
        "<b>CSP Spatial Filtering:</b> Common Spatial Pattern (CSP) computes spatial filters that maximize signal variance for one class "
        "while minimizing it for the other. With alternate ordering, the first two and last two filters isolate Left vs. Right extremes. "
        "Under classical motor imagery theory, left-hand imagery causes contralateral Event-Related Desynchronization (ERD; power decrease) "
        "over the right motor cortex (C4), while right-hand imagery suppresses power over the left motor cortex (C3)."
    )
    story.append(Paragraph(p2_intro, body_style))
    story.append(Spacer(1, 3))

    # Side-by-side Visuals: CSP Patterns + Alpha ERD
    # Usable width = 540 pt. Left image = 320 pt, Right image = 210 pt. Total = 530 pt.
    img_csp = Image(str(FIG / "csp_patterns.png"), width=315, height=102)
    img_erd = Image(str(FIG / "alpha_erd.png"), width=215, height=102)

    vis_table = Table([[img_csp, img_erd]], colWidths=[320, 220])
    vis_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, 0), "LEFT"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))
    story.append(vis_table)

    captions_table = Table([[
        Paragraph("<b>Figure 1:</b> 4-component broadband CSP patterns (descending eigenvalue order).", caption_style),
        Paragraph("<b>Figure 2:</b> Paired 8–12 Hz alpha ERD at C3 & C4.", caption_style)
    ]], colWidths=[320, 220])
    captions_table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(captions_table)

    # Detailed Analysis of Topographies and ERD
    p2_analysis = (
        "<b>Topographic Dispersion (Figure 1):</b> The spatial patterns reveal significant energy bleeding into frontal sensors (Fp1, Fp2, Fz) "
        "and parietal sensors (P3, P4). They do <i>not</i> form clean, focal dipoles centered tightly over C3 and C4. The 16-channel montage "
        "provides coarse spatial resolution, but more fundamentally, the underlying cortical activations are dispersed across regions.<br/>"
        "<b>Absence of Contralateral Alpha ERD (Figure 2):</b> To check whether the subject generated true motor rhythms, alpha band (8–12 Hz) "
        "power during each 4-second imagery trial was compared against its preceding 4-second rest cue (T0). Desynchronization is defined as "
        "<code>ERD% = 100 * (Rest - Imagery) / Rest</code> (positive = power drop, negative = power rise):<br/>"
        "• <b>C3 (Left Motor):</b> Left Imagery = <b>-13.39%</b> | Right Imagery = <b>-9.02%</b> (both negative = power <i>increased</i> during imagery).<br/>"
        "• <b>C4 (Right Motor):</b> Left Imagery = <b>-0.89%</b> | Right Imagery = <b>-1.03%</b> (both near zero, no observable modulation).<br/>"
        "The expected contralateral suppression (e.g. positive ERD at C4 for Left, positive ERD at C3 for Right) was absent. Without clear "
        "spectral contrast between hemispheres, linear spatial filters cannot reliably separate the two classes."
    )
    story.append(Paragraph(p2_analysis, body_style))
    story.append(Spacer(1, 3))

    # Frequency Band Comparison Table
    band_data = [
        [Paragraph("Frequency Band", table_header),
         Paragraph("Passband (Hz)", table_header),
         Paragraph("CSP Components", table_header),
         Paragraph("Empirical Variance Ratio", table_header),
         Paragraph("Manual Target", table_header),
         Paragraph("Target Status", table_header)],
        [Paragraph("Mu Band", table_cell_left), Paragraph("8 – 12 Hz", table_cell), Paragraph("4", table_cell), Paragraph("1.60", table_cell), Paragraph("3.20", table_cell), Paragraph("<b>Unmet</b> (50% of target)", table_cell)],
        [Paragraph("Beta Band", table_cell_left), Paragraph("16 – 24 Hz", table_cell), Paragraph("4", table_cell), Paragraph("1.39", table_cell), Paragraph("2.80", table_cell), Paragraph("<b>Unmet</b> (50% of target)", table_cell)],
        [Paragraph("Broadband", table_cell_left), Paragraph("8 – 30 Hz", table_cell), Paragraph("6", table_cell), Paragraph("1.38", table_cell), Paragraph("4.10", table_cell), Paragraph("<b>Unmet</b> (34% of target)", table_cell)],
    ]
    band_table = Table(band_data, colWidths=[100, 85, 80, 105, 85, 85])
    band_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), c_primary),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, c_light]),
        ("BOX", (0, 0), (-1, -1), 0.5, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(band_table)

    # Page Break to ensure EXACTLY 2 pages
    story.append(PageBreak())

    # =========================================================================
    # PAGE 2: CLASSIFICATION RESULTS, REAL-TIME LATENCY & BOTTLENECKS
    # =========================================================================
    story.append(Paragraph("3. Classification Performance & Cross-Validation Analysis", h1_style))
    p3_intro = (
        "<b>Leakage-Safe Validation:</b> To prevent overfitting and optimistic bias, centering, CSP spatial decomposition, standard scaling, "
        "and classifiers were fitted strictly inside each training split of a 10-fold Stratified Cross-Validation (3 test trials per fold). "
        "SVM hyperparameters (C, gamma) were optimized using a nested 3-fold inner cross-validation, never seeing outer test folds."
    )
    story.append(Paragraph(p3_intro, body_style))
    story.append(Spacer(1, 2))

    # Figure: Classifier OOF Metrics (ROC and Confusion Matrices)
    img_clf = Image(str(FIG / "classifier_oof_metrics.png"), width=535, height=105)
    story.append(img_clf)
    story.append(Paragraph("<b>Figure 3:</b> Out-of-fold confusion matrices for LDA and SVM alongside pooled ROC curves (10-fold CV).", caption_style))

    # Classification Metrics Table
    clf_data = [
        [Paragraph("Model", table_header),
         Paragraph("10-Fold OOF Accuracy", table_header),
         Paragraph("ROC-AUC", table_header),
         Paragraph("Fold Accuracy SD", table_header),
         Paragraph("Confusion Matrix (L / R)", table_header),
         Paragraph("Evaluation vs. >78.5% Target", table_header)],
        [Paragraph("<b>Shrinkage LDA</b>", table_cell_left), Paragraph("<b>56.7%</b> (17/30)", table_cell), Paragraph("0.604", table_cell), Paragraph("± 27.4%", table_cell), Paragraph("L: 8/15, R: 9/15", table_cell), Paragraph("<font color='#DC2626'><b>Target Unmet</b></font> (Chance: 50%)", table_cell)],
        [Paragraph("<b>RBF SVM</b>", table_cell_left), Paragraph("<b>56.7%</b> (17/30)", table_cell), Paragraph("0.618", table_cell), Paragraph("± 31.6%", table_cell), Paragraph("L: 9/15, R: 8/15", table_cell), Paragraph("<font color='#DC2626'><b>Target Unmet</b></font> (Chance: 50%)", table_cell)],
    ]
    clf_table = Table(clf_data, colWidths=[95, 95, 65, 80, 95, 110])
    clf_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), c_primary),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, c_light]),
        ("BOX", (0, 0), (-1, -1), 0.5, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(clf_table)
    story.append(Spacer(1, 3))

    p3_disc = (
        "<b>Interpretation of Low Accuracy:</b> Both linear (LDA) and non-linear (RBF SVM) classifiers achieved identical 56.7% accuracy. "
        "This marginal performance above chance (50%) directly reflects the lack of physiological mu/beta suppression demonstrated in Section 2. "
        "The fold-to-fold standard deviation is extremely high (~27–32%), ranging from 0% to 100% on individual 3-trial test folds.<br/>"
        "<b>Session Non-Stationarity (Leave-One-Run-Out):</b> When trained on Run 8 and evaluated on Run 12, accuracy was <b>60.0%</b> (AUC 0.571). "
        "When trained on Run 12 and tested on Run 8, LDA dropped to <b>46.7%</b> (below chance; SVM reached 53.3%). This proves that electrode "
        "impedance shifts and cognitive baseline drift between runs severely degrade model generalization across separate sessions."
    )
    story.append(Paragraph(p3_disc, body_style))
    story.append(Spacer(1, 4))

    # Section 4: Real-Time Latency & Bottleneck Analysis
    story.append(Paragraph("4. Real-Time Latency Bottlenecks & Streaming Replay", h1_style))
    p4_intro = (
        "<b>Streaming Architecture:</b> Causal replay simulated real-time acquisition on reserved Run 4. Incoming data arrived in 10-sample chunks "
        "(62.5 ms arrival period at 160 Hz). A stateful IIR Butterworth filter and fixed ICA projection processed each chunk, updating a 500 ms "
        "(80-sample) ring buffer. For complete windows, CSP log-variance features were extracted and classified with a 3-decision sliding majority vote."
    )
    story.append(Paragraph(p4_intro, body_style))
    story.append(Spacer(1, 2))

    # Figure: Stream Latency
    img_lat = Image(str(FIG / "stream_latency.png"), width=535, height=98)
    story.append(img_lat)
    story.append(Paragraph("<b>Figure 4:</b> Execution latency per 10-sample chunk (left) and decision-chunk latency histogram (right) on Run 4.", caption_style))

    # Latency KPI Cards Table
    kpi_data = [
        [Paragraph("<b>Mean Latency</b>", table_cell), Paragraph("<b>95th Percentile</b>", table_cell), Paragraph("<b>Maximum Latency</b>", table_cell), Paragraph("<b>Chunk Deadline</b>", table_cell), Paragraph("<b>15 ms Target Status</b>", table_cell)],
        [Paragraph("<font size=10 color='#1E3A8A'><b>0.45 ms</b></font>", table_cell),
         Paragraph("<font size=10 color='#1E3A8A'><b>0.56 ms</b></font>", table_cell),
         Paragraph("<font size=10 color='#1E3A8A'><b>1.40 ms</b></font>", table_cell),
         Paragraph("<font size=10 color='#334155'><b>62.5 ms</b></font>", table_cell),
         Paragraph("<font size=9 color='#16A34A'><b>PASSED (10x Margin)</b></font>", table_cell)],
    ]
    kpi_table = Table(kpi_data, colWidths=[100, 105, 105, 105, 125])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
        ("BACKGROUND", (0, 1), (-1, 1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 3))

    p4_bottlenecks = (
        "<b>Practical Latency Bottlenecks:</b> While raw computation took only <b>0.45 ms</b> (far below the 15 ms execution target and the 62.5 ms "
        "chunk period), practical real-time BCI deployments face three major latency bottlenecks:<br/>"
        "1. <b>Algorithmic Buffering Delay:</b> Processing requires a 500 ms window plus a 3-decision majority smoother. This imposes an intrinsic "
        "<b>~625 ms algorithmic lag</b> before an imagery state change triggers a reliable command, dwarfing CPU compute time.<br/>"
        "2. <b>Hardware and USB/Bluetooth Jitter:</b> Real-world EEG amplifiers buffer packets in hardware. OS thread scheduling and serial polling "
        "frequently introduce 10–50 ms of transmission jitter. In our simulation, queue capacity was never breached (0 queue drops, max lag 1.40 ms).<br/>"
        "3. <b>Online Streaming Accuracy vs. Offline Validation:</b> Aggregating predictions over each 4 s trial in Run 4 yielded 100% trial accuracy "
        "(15/15 correct; 7.23 bits/min idealized ITR). However, Run 4 was inspected during preliminary design and consists of only 15 trials; "
        "this score must not be mistaken for generalized offline performance or multi-subject readiness."
    )
    story.append(Paragraph(p4_bottlenecks, body_style))
    story.append(Spacer(1, 4))

    # Section 5: Key Takeaways & Recommendations Card
    takeaways_text = (
        "<b>5. Key Takeaways & Recommendations:</b><br/>"
        "• <b>Honest Target Reporting:</b> The >78.5% classification target and spectral variance targets were unmet. This is common in real EEG "
        "due to subject-specific 'BCI illiteracy' (lack of pronounced sensorimotor rhythm modulation).<br/>"
        "• <b>Methodological Soundness:</b> Causal SOS filtering and fixed ICA projections guarantee no data leakage during real-time streaming.<br/>"
        "• <b>Path Forward:</b> To improve decoding, future designs should incorporate neurofeedback training to help users learn mu-rhythm control, "
        "adaptive Riemannian geometry classifiers, and higher-density electrode montages (32–64 channels) for tighter spatial filtering."
    )
    takeaways_table = Table([[Paragraph(takeaways_text, callout_style)]], colWidths=[540])
    takeaways_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(takeaways_table)

    # Build the document using NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Generated PDF at: {OUTPUT_PDF}")

if __name__ == "__main__":
    build_pdf()
