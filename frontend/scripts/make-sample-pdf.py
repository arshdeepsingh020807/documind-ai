"""Generates public/samples/glacier-field-notes.pdf, the sample document offered on the landing page.

The text is original and fictional (written for DocuMind demos). Run from the repo root with the project venv:
    .venv/bin/python frontend/scripts/make-sample-pdf.py
"""
import fitz

PAGES = [
    ("Hvítárjökull Ice Cap Survey", "Field notes, summer 2024",
     [("Overview", "This survey measured how quickly the Hvítárjökull ice cap is thinning. Dr Maren Holt led a field team of "
       "six people across three summers, from 2022 to 2024. The ice cap covers about 38 square kilometres, and its "
       "southern margin sits on gently sloping bedrock that makes it easy to reach on foot."),
      ("Methods", "The team drilled 14 stakes into the ice in a grid and re-measured each one every two weeks. Thickness "
       "was checked with ground-penetrating radar at 25 MHz, towed on a sledge along fixed lines. Temperature loggers "
       "were buried 30 centimetres deep at five of the stake sites to record how heat moves into the snow."),
      ("Equipment", "All stakes were 3-metre aluminium tubes. The radar sledge weighed 18 kilograms and ran on two "
       "lithium batteries, which lasted about nine hours in cold weather. Base camp was a single hut with room "
       "for eight people, reached by a two-hour hike from the nearest road.")]),
    ("Results and next steps", "Summer 2024",
     [("Thinning", "Between 2019 and 2024 the ice cap thinned by an average of 1.8 metres per year. The southern margin "
       "lost the most, at 2.6 metres per year, while the high plateau lost only 0.7 metres per year. The warmest month "
       "of the survey was July 2023, when stakes near the margin dropped by 31 centimetres in two weeks."),
      ("Limits of the data", "Radar readings are less reliable below 150 metres, where meltwater scatters the signal. "
       "Two stakes were lost to crevasse movement in 2023 and were not replaced, so the southern average rests on "
       "eleven stakes rather than fourteen."),
      ("Next steps", "The team plans to add six stakes on the plateau in 2025 and to test a lighter radar unit. A "
       "funding request of 42,000 euros has been submitted to cover two extra field assistants and replacement "
       "batteries. Final results will be shared with the national weather service in March 2026.")]),
]

doc = fitz.open()
for title, subtitle, sections in PAGES:
    page = doc.new_page()  # A4
    y = 64
    page.insert_text((56, y), title, fontsize=22, fontname="hebo"); y += 24
    page.insert_text((56, y), subtitle, fontsize=11, fontname="helv", color=(0.4, 0.4, 0.4)); y += 30
    for heading, body in sections:
        page.insert_text((56, y), heading, fontsize=13, fontname="hebo"); y += 8
        used = page.insert_textbox(fitz.Rect(56, y, 540, y + 200), body, fontsize=11, fontname="helv", lineheight=1.45)
        y += 200 - used + 18
    page.insert_text((56, 800), "Fictional sample document created for DocuMind demos.", fontsize=8, color=(0.5, 0.5, 0.5))

doc.set_metadata({"title": "Hvítárjökull Ice Cap Survey (sample)", "author": "DocuMind sample"})
doc.save("frontend/public/samples/glacier-field-notes.pdf", garbage=4, deflate=True)
print("pages:", len(doc), "words:", sum(len(p.get_text().split()) for p in doc))
