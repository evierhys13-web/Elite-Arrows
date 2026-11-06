import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Flowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

class AcroFieldFlowable(Flowable):
    def __init__(self, field_type, name, width, height, value='', options=None):
        super().__init__()
        self.field_type = field_type # 'text' or 'checkbox'
        self.name = name
        self.width = width
        self.height = height
        self.value = value
        self.options = options or {}

    def wrap(self, availWidth, availHeight):
        return self.width, self.height

    def draw(self):
        form = self.canv.acroForm
        if self.field_type == 'text':
            form.textfield(
                name=self.name,
                tooltip=self.name,
                x=0, y=0,
                width=self.width, height=self.height,
                value=self.value,
                borderColor=colors.HexColor('#9ca3af'),
                fillColor=colors.HexColor('#ffffff'),
                textColor=colors.HexColor('#1f2937'),
                fontSize=9,
                **self.options
            )
        elif self.field_type == 'checkbox':
            form.checkbox(
                name=self.name,
                tooltip=self.name,
                x=0, y=0,
                size=self.height,
                checked=False,
                borderColor=colors.HexColor('#9ca3af'),
                fillColor=colors.HexColor('#ffffff'),
                textColor=colors.HexColor('#1f2937')
            )

def generate_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=36, leftMargin=36,
        topMargin=36, bottomMargin=36
    )
    story = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle', parent=styles['Heading1'],
        fontName='Helvetica-Bold', fontSize=18, leading=22,
        textColor=colors.HexColor('#111827')
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8.5, leading=12,
        textColor=colors.HexColor('#4b5563')
    )
    section_style = ParagraphStyle(
        'SectionHeader', parent=styles['Heading2'],
        fontName='Helvetica-Bold', fontSize=10.5, leading=14,
        textColor=colors.HexColor('#065f46')
    )
    cell_style = ParagraphStyle(
        'CellText', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8.5, leading=11,
        textColor=colors.HexColor('#1f2937')
    )
    cell_bold = ParagraphStyle(
        'CellTextBold', parent=cell_style, fontName='Helvetica-Bold'
    )
    cell_center = ParagraphStyle(
        'CellCenter', parent=cell_style, alignment=1
    )

    story.append(Paragraph("Daily Scorecard", title_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("Complete one card each day. Add the three part totals, then copy the Total into the Weekly Tracker.", subtitle_style))
    story.append(Spacer(1, 8))

    # Top fields: Day, Date, Player
    top_table_data = [
        [
            Paragraph("<b>Day:</b>", cell_style), AcroFieldFlowable('text', 'day', 50, 18, 'Day 1'),
            Paragraph("<b>Date:</b>", cell_style), AcroFieldFlowable('text', 'date', 80, 18),
            Paragraph("<b>Player:</b>", cell_style), AcroFieldFlowable('text', 'player_name', 180, 18)
        ]
    ]
    t_top = Table(top_table_data, colWidths=[30, 60, 35, 90, 45, 190])
    t_top.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#d1d5db')),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f9fafb')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_top)
    story.append(Spacer(1, 10))

    # --- Part 1 - Shanghai 10-15 ---
    story.append(Paragraph("■ Part 1 - Shanghai 10-15", section_style))
    story.append(Spacer(1, 3))

    p1_rows = [
        [Paragraph("<b>Target</b>", cell_bold), Paragraph("<b>Dart 1</b>", cell_bold), Paragraph("<b>Dart 2</b>", cell_bold), Paragraph("<b>Dart 3</b>", cell_bold), Paragraph("<b>Visit Total</b>", cell_bold), Paragraph("<b>Shanghai (+100)</b>", cell_bold)],
    ]
    for idx, target in enumerate([10, 11, 12, 13, 14, 15]):
        p1_rows.append([
            Paragraph(f"<b>{target}</b>", cell_center),
            AcroFieldFlowable('text', f'p1_t{target}_d1', 75, 16),
            AcroFieldFlowable('text', f'p1_t{target}_d2', 75, 16),
            AcroFieldFlowable('text', f'p1_t{target}_d3', 75, 16),
            AcroFieldFlowable('text', f'p1_t{target}_tot', 85, 16),
            AcroFieldFlowable('checkbox', f'p1_t{target}_shanghai', 14, 14)
        ])
    p1_rows.append([
        Paragraph("<b>Part 1 Total:</b>", cell_bold), "", "", "", "", AcroFieldFlowable('text', 'p1_total', 100, 18)
    ])

    t_p1 = Table(p1_rows, colWidths=[60, 85, 85, 85, 95, 130])
    t_p1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f3f4f6')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#9ca3af')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#d1d5db')),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f9fafb')),
        ('ALIGN', (5,1), (5,-2), 'CENTER'),
    ]))
    story.append(t_p1)
    story.append(Spacer(1, 10))

    # --- Part 2 - Doubles 1-20 + Bull ---
    story.append(Paragraph("■ Part 2 - Doubles 1-20 + Bull", section_style))
    story.append(Spacer(1, 3))

    doubles_names = [f'd{i}' for i in range(1, 21)] + ['bull']
    doubles_labels = [f'D{i}' for i in range(1, 21)] + ['Bull (100)']

    d_grid_rows = []
    current_row = []
    for idx, label in enumerate(doubles_labels):
        current_row.extend([
            AcroFieldFlowable('checkbox', f'p2_{doubles_names[idx]}', 12, 12),
            Paragraph(f"<b>{label}</b>", cell_style)
        ])
        if len(current_row) == 14: # 7 items per row (each item is checkbox + label)
            d_grid_rows.append(current_row)
            current_row = []
    if current_row:
        while len(current_row) < 14:
            current_row.extend(["", ""])
        d_grid_rows.append(current_row)

    col_widths_d = [18, 55, 18, 55, 18, 55, 18, 55, 18, 55, 18, 55, 18, 70]
    t_doubles_grid = Table(d_grid_rows, colWidths=col_widths_d)
    t_doubles_grid.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#d1d5db')),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f9fafb')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_doubles_grid)
    story.append(Spacer(1, 6))

    p2_calc_data = [
        [
            Paragraph("<font size=7.5 color='#4b5563'>Each double hit = 50 points. Inner bull = 100 points.</font>", cell_style),
            Paragraph("<b>Doubles hit:</b>", cell_style), AcroFieldFlowable('text', 'p2_doubles_hit', 40, 16),
            Paragraph("<b>Part 2 Total:</b>", cell_bold), AcroFieldFlowable('text', 'p2_total', 80, 18)
        ]
    ]
    t_p2_calc = Table(p2_calc_data, colWidths=[240, 75, 45, 75, 105])
    t_p2_calc.setStyle(TableStyle([
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_p2_calc)
    story.append(Spacer(1, 10))

    # --- Part 3 - Shanghai 15-20 ---
    story.append(Paragraph("■ Part 3 - Shanghai 15-20", section_style))
    story.append(Spacer(1, 3))

    p3_rows = [
        [Paragraph("<b>Target</b>", cell_bold), Paragraph("<b>Dart 1</b>", cell_bold), Paragraph("<b>Dart 2</b>", cell_bold), Paragraph("<b>Dart 3</b>", cell_bold), Paragraph("<b>Visit Total</b>", cell_bold), Paragraph("<b>Shanghai (+100)</b>", cell_bold)],
    ]
    for idx, target in enumerate([15, 16, 17, 18, 19, 20]):
        p3_rows.append([
            Paragraph(f"<b>{target}</b>", cell_center),
            AcroFieldFlowable('text', f'p3_t{target}_d1', 75, 16),
            AcroFieldFlowable('text', f'p3_t{target}_d2', 75, 16),
            AcroFieldFlowable('text', f'p3_t{target}_d3', 75, 16),
            AcroFieldFlowable('text', f'p3_t{target}_tot', 85, 16),
            AcroFieldFlowable('checkbox', f'p3_t{target}_shanghai', 14, 14)
        ])
    p3_rows.append([
        Paragraph("<b>Part 3 Total:</b>", cell_bold), "", "", "", "", AcroFieldFlowable('text', 'p3_total', 100, 18)
    ])

    t_p3 = Table(p3_rows, colWidths=[60, 85, 85, 85, 95, 130])
    t_p3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f3f4f6')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#9ca3af')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#d1d5db')),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f9fafb')),
        ('ALIGN', (5,1), (5,-2), 'CENTER'),
    ]))
    story.append(t_p3)
    story.append(Spacer(1, 10))

    # --- Summary Box: Total Attempt Score & 6 Score Bands ---
    bands = ['Premier', 'Elite', 'Emerald 1', 'Emerald 2', 'Diamond', 'Platinum']
    band_elements = []
    for band in bands:
        band_elements.extend([
            AcroFieldFlowable('checkbox', f'band_{band.lower().replace(" ", "_")}', 12, 12),
            Paragraph(f"<b>{band}</b>", cell_style)
        ])

    # We can layout the 6 score bands in 2 rows of 3
    band_row1 = band_elements[0:6]
    band_row2 = band_elements[6:12]

    band_table = Table([band_row1, band_row2], colWidths=[16, 85, 16, 85, 16, 85])
    band_table.setStyle(TableStyle([
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))

    summary_data = [
        [
            Paragraph("<b>TOTAL ATTEMPT SCORE</b>", ParagraphStyle('ScoreTitle', parent=cell_bold, fontSize=9, textColor=colors.HexColor('#065f46'))),
            Paragraph("<b>SCORE BANDS (6 Divisions)</b>", ParagraphStyle('BandTitle', parent=cell_bold, fontSize=9, textColor=colors.HexColor('#065f46')))
        ],
        [
            AcroFieldFlowable('text', 'total_attempt_score', 140, 22),
            band_table
        ]
    ]
    t_summary = Table(summary_data, colWidths=[180, 360])
    t_summary.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor('#059669')),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#ecfdf5')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_summary)
    story.append(Spacer(1, 8))

    # --- Notes Box ---
    notes_data = [
        [Paragraph("<b>NOTES / WHAT TO IMPROVE</b>", cell_bold)],
        [AcroFieldFlowable('text', 'notes', 524, 28)]
    ]
    t_notes = Table(notes_data, colWidths=[540])
    t_notes.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#d1d5db')),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f9fafb')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_notes)
    story.append(Spacer(1, 6))

    # Footer
    footer_data = [
        [
            Paragraph("Daily Scorecard - Day 1", ParagraphStyle('FL', parent=cell_style, fontSize=7, textColor=colors.HexColor('#6b7280'))),
            Paragraph("Copy this Total into the Weekly Tracker.", ParagraphStyle('FR', parent=cell_style, fontSize=7, textColor=colors.HexColor('#6b7280'), alignment=2))
        ]
    ]
    t_footer = Table(footer_data, colWidths=[270, 270])
    t_footer.setStyle(TableStyle([
        ('TOPPADDING', (0,0), (-1,-1), 1),
        ('BOTTOMPADDING', (0,0), (-1,-1), 1),
    ]))
    story.append(t_footer)

    doc.build(story)
    print(f"Successfully generated interactive JDC Daily Scorecard PDF at {output_path}")

if __name__ == '__main__':
    os.makedirs('public', exist_ok=True)
    generate_pdf('public/jdc-scoresheet.pdf')
