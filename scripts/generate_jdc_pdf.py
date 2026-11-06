import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=40, leftMargin=40,
        topMargin=40, bottomMargin=40
    )
    story = []
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        alignment=1, # Center
        textColor=colors.HexColor('#1e1b4b')
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        alignment=1,
        textColor=colors.HexColor('#4f46e5')
    )
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#111827')
    )
    cell_style = ParagraphStyle(
        'CellText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#1f2937')
    )
    cell_bold = ParagraphStyle(
        'CellTextBold',
        parent=cell_style,
        fontName='Helvetica-Bold'
    )

    story.append(Paragraph("JUNIOR DARTS CORPORATION (JDC)", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Official Monthly Challenge Scoresheet", subtitle_style))
    story.append(Spacer(1, 15))

    # Player Details Box
    details_data = [
        [Paragraph("<b>Player Name:</b> ___________________________", cell_style),
         Paragraph("<b>Date Completed:</b> ____ / ____ / 20___", cell_style)],
        [Paragraph("<b>Division:</b> ___________________________", cell_style),
         Paragraph("<b>Total JDC Score:</b> ___________ / 1000", cell_style)]
    ]
    t_details = Table(details_data, colWidths=[270, 260])
    t_details.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f9fafb')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#d1d5db')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e5e7eb')),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_details)
    story.append(Spacer(1, 20))

    story.append(Paragraph("Routine & Scoring Breakdown", section_style))
    story.append(Spacer(1, 8))

    # Scoresheet Main Table
    table_data = [
        [Paragraph("<b>Routine / Segment</b>", cell_bold), Paragraph("<b>Target / Format</b>", cell_bold), Paragraph("<b>Score Achieved</b>", cell_bold)],
        [Paragraph("1. Scoring (Segments 10-20 & Bull)", cell_style), Paragraph("3 Darts per segment", cell_style), Paragraph("", cell_style)],
        [Paragraph("2. Doubles (1-20 & Bull)", cell_style), Paragraph("Hit each double in sequence", cell_style), Paragraph("", cell_style)],
        [Paragraph("3. Trebles & Scoring Power", cell_style), Paragraph("Standard JDC Rules", cell_style), Paragraph("", cell_style)],
        [Paragraph("4. Finishing & Checkouts", cell_style), Paragraph("121 / Outshots format", cell_style), Paragraph("", cell_style)],
    ]
    t_main = Table(table_data, colWidths=[200, 180, 150])
    t_main.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e0e7ff')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#9ca3af')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#d1d5db')),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_main)
    story.append(Spacer(1, 30))

    # Signatures
    sig_data = [
        [Paragraph("<b>Marker / Witness Signature:</b><br/><br/>_____________________________________", cell_style),
         Paragraph("<b>Player Signature:</b><br/><br/>_____________________________________", cell_style)]
    ]
    t_sig = Table(sig_data, colWidths=[265, 265])
    t_sig.setStyle(TableStyle([
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_sig)

    doc.build(story)
    print(f"Successfully generated PDF at {output_path}")

if __name__ == '__main__':
    os.makedirs('public', exist_ok=True)
    generate_pdf('public/jdc-scoresheet.pdf')
