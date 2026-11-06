import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=36, leftMargin=36,
        topMargin=36, bottomMargin=36
    )
    story = []
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#111827')
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#4b5563')
    )
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#065f46')
    )
    cell_style = ParagraphStyle(
        'CellText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1f2937')
    )
    cell_bold = ParagraphStyle(
        'CellTextBold',
        parent=cell_style,
        fontName='Helvetica-Bold'
    )
    cell_center = ParagraphStyle(
        'CellCenter',
        parent=cell_style,
        alignment=1
    )
    footer_right_style = ParagraphStyle(
        'FooterRight',
        parent=cell_style,
        fontName='Helvetica',
        fontSize=7,
        leading=9,
        textColor=colors.HexColor('#6b7280'),
        alignment=2
    )
    footer_left_style = ParagraphStyle(
        'FooterLeft',
        parent=cell_style,
        fontName='Helvetica',
        fontSize=7,
        leading=9,
        textColor=colors.HexColor('#6b7280'),
        alignment=0
    )

    # Title & Subtitle
    story.append(Paragraph("Daily Scorecard", title_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph("Complete one card each day. Add the three part totals, then copy the Total into the Weekly Tracker.", subtitle_style))
    story.append(Spacer(1, 10))

    # Top fields: Day, Date, Player
    top_data = [
        [
            Paragraph("<b>Day:</b> Day 1", cell_style),
            Paragraph("<b>Date:</b> ____/____/20___", cell_style),
            Paragraph("<b>Player:</b> ___________________________", cell_style)
        ]
    ]
    t_top = Table(top_data, colWidths=[90, 130, 320])
    t_top.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#d1d5db')),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f9fafb')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_top)
    story.append(Spacer(1, 12))

    # --- Part 1 - Shanghai 10-15 ---
    story.append(Paragraph("■ Part 1 - Shanghai 10-15", section_style))
    story.append(Spacer(1, 4))

    p1_rows = [
        [Paragraph("<b>Target</b>", cell_bold), Paragraph("<b>Dart 1</b>", cell_bold), Paragraph("<b>Dart 2</b>", cell_bold), Paragraph("<b>Dart 3</b>", cell_bold), Paragraph("<b>Visit Total</b>", cell_bold), Paragraph("<b>Shanghai (+100)</b>", cell_bold)],
    ]
    for target in [10, 11, 12, 13, 14, 15]:
        p1_rows.append([
            Paragraph(f"<b>{target}</b>", cell_center),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph("[   ]", cell_center)
        ])
    p1_rows.append([
        Paragraph("<b>Part 1 Total:</b>", cell_bold), "", "", "", "", Paragraph("________", cell_center)
    ])

    t_p1 = Table(p1_rows, colWidths=[65, 85, 85, 85, 95, 125])
    t_p1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f3f4f6')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#9ca3af')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#d1d5db')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f9fafb')),
    ]))
    story.append(t_p1)
    story.append(Spacer(1, 12))

    # --- Part 2 - Doubles 1-20 + Bull ---
    story.append(Paragraph("■ Part 2 - Doubles 1-20 + Bull", section_style))
    story.append(Spacer(1, 4))

    doubles_items = [
        "[ ] D1", "[ ] D2", "[ ] D3", "[ ] D4", "[ ] D5", "[ ] D6", "[ ] D7",
        "[ ] D8", "[ ] D9", "[ ] D10", "[ ] D11", "[ ] D12", "[ ] D13", "[ ] D14",
        "[ ] D15", "[ ] D16", "[ ] D17", "[ ] D18", "[ ] D19", "[ ] D20", "[ ] Bull (100)"
    ]
    d_rows = []
    for i in range(0, len(doubles_items), 7):
        chunk = doubles_items[i:i+7]
        while len(chunk) < 7:
            chunk.append("")
        d_rows.append([Paragraph(item, cell_style) for item in chunk])

    t_doubles_grid = Table(d_rows, colWidths=[78]*7)
    t_doubles_grid.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#d1d5db')),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f9fafb')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_doubles_grid)
    story.append(Spacer(1, 6))

    p2_calc_data = [
        [
            Paragraph("<font size=8 color='#4b5563'>Each double hit = 50 points. Inner bull = 100 points.</font>", cell_style),
            Paragraph("<b>Doubles hit:</b> [___] x 50 =", cell_style),
            Paragraph("<b>Part 2 Total:</b> ________", cell_bold)
        ]
    ]
    t_p2_calc = Table(p2_calc_data, colWidths=[240, 150, 150])
    t_p2_calc.setStyle(TableStyle([
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_p2_calc)
    story.append(Spacer(1, 12))

    # --- Part 3 - Shanghai 15-20 ---
    story.append(Paragraph("■ Part 3 - Shanghai 15-20", section_style))
    story.append(Spacer(1, 4))

    p3_rows = [
        [Paragraph("<b>Target</b>", cell_bold), Paragraph("<b>Dart 1</b>", cell_bold), Paragraph("<b>Dart 2</b>", cell_bold), Paragraph("<b>Dart 3</b>", cell_bold), Paragraph("<b>Visit Total</b>", cell_bold), Paragraph("<b>Shanghai (+100)</b>", cell_bold)],
    ]
    for target in [15, 16, 17, 18, 19, 20]:
        p3_rows.append([
            Paragraph(f"<b>{target}</b>", cell_center),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph("", cell_style),
            Paragraph("[   ]", cell_center)
        ])
    p3_rows.append([
        Paragraph("<b>Part 3 Total:</b>", cell_bold), "", "", "", "", Paragraph("________", cell_center)
    ])

    t_p3 = Table(p3_rows, colWidths=[65, 85, 85, 85, 95, 125])
    t_p3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f3f4f6')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#9ca3af')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#d1d5db')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f9fafb')),
    ]))
    story.append(t_p3)
    story.append(Spacer(1, 14))

    # --- Summary Box: Total Attempt Score & Score Band ---
    summary_data = [
        [
            Paragraph("<b>TOTAL ATTEMPT SCORE</b><br/><br/><b>___________</b>", ParagraphStyle('ScoreBox', parent=cell_bold, fontSize=12, leading=16)),
            Paragraph("<b>SCORE BAND (this attempt)</b><br/><br/>[   ] Green    [   ] Amber    [   ] Red", cell_style)
        ]
    ]
    t_summary = Table(summary_data, colWidths=[200, 340])
    t_summary.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor('#059669')),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#ecfdf5')),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_summary)
    story.append(Spacer(1, 10))

    # --- Notes Box ---
    notes_data = [
        [Paragraph("<b>NOTES / WHAT TO IMPROVE</b><br/><br/><br/>", cell_style)]
    ]
    t_notes = Table(notes_data, colWidths=[540])
    t_notes.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#d1d5db')),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f9fafb')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_notes)
    story.append(Spacer(1, 8))

    # Footer
    footer_data = [
        [
            Paragraph("Daily Scorecard - Day 1", footer_left_style),
            Paragraph("Copy this Total into the Weekly Tracker.", footer_right_style)
        ]
    ]
    t_footer = Table(footer_data, colWidths=[270, 270])
    t_footer.setStyle(TableStyle([
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(t_footer)

    doc.build(story)
    print(f"Successfully generated JDC Daily Scorecard PDF at {output_path}")

if __name__ == '__main__':
    os.makedirs('public', exist_ok=True)
    generate_pdf('public/jdc-scoresheet.pdf')
