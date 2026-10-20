import io

import docx
import fitz

TEXT = (
    "The Aurora project launched in 2021. It studies glacier melt in Iceland. "
    "The lead scientist is Dr Helga Sigurdsson. "
) * 30


def make_pdf(text: str = TEXT) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_textbox(fitz.Rect(40, 40, 550, 800), text[:1500], fontsize=11)
    data = doc.tobytes()
    doc.close()
    return data


def make_docx(text: str = TEXT) -> bytes:
    document = docx.Document()
    document.add_paragraph(text)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def make_blank_pdf() -> bytes:
    doc = fitz.open()
    doc.new_page()
    data = doc.tobytes()
    doc.close()
    return data


def upload(client, name: str, content: bytes, content_type: str = "application/octet-stream"):
    return client.post("/documents/upload", files={"file": (name, content, content_type)})


def make_multipage_pdf(pages: list[str]) -> bytes:
    """One PDF page per entry; an empty string makes a blank page."""
    doc = fitz.open()
    for text in pages:
        page = doc.new_page()
        if text:
            page.insert_textbox(fitz.Rect(40, 40, 550, 800), text, fontsize=11)
    data = doc.tobytes()
    doc.close()
    return data
