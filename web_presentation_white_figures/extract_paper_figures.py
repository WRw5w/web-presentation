from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / "materials" / "arXiv-2601.05930v2 copy" / "figures"
OUTPUT = ROOT / "assets" / "paper-figures"


def render(pdf_name: str, output_name: str, columns: int, rows: int) -> None:
    document = fitz.open(SOURCE / pdf_name)
    page = document[0]
    full = page.get_pixmap(matrix=fitz.Matrix(3, 3), alpha=False)
    full.save(OUTPUT / f"{output_name}-full.png")

    page_rect = page.rect
    cell_width = page_rect.width / columns
    cell_height = page_rect.height / rows
    for row in range(rows):
        for column in range(columns):
            index = row * columns + column + 1
            clip = fitz.Rect(
                column * cell_width,
                row * cell_height,
                (column + 1) * cell_width,
                (row + 1) * cell_height,
            )
            pixmap = page.get_pixmap(matrix=fitz.Matrix(4, 4), clip=clip, alpha=False)
            pixmap.save(OUTPUT / f"{output_name}-{index:02d}.png")


OUTPUT.mkdir(parents=True, exist_ok=True)
render("agent.pdf", "agent", 3, 1)
render("analysis_main.pdf", "analysis", 3, 2)
