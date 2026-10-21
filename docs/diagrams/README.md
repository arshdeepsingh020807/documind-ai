# DocuMind diagrams

Editable [draw.io](https://www.diagrams.net/) files (plain XML, so they also diff cleanly in Git). Each file opens straight into the editor; files with several pages show them as tabs along the bottom.

| File | Pages | What it shows |
|---|---|---|
| `01-use-case.drawio` | 1 | Who can do what: the user, the AI provider, and what each goal includes or optionally extends |
| `02-activity.drawio` | 2 | Swimlane activity diagrams (User, Web app, API server, AI provider): upload and process a document, then ask a question and verify the answer |
| `03-control-flow.drawio` | 2 | Code-level flowcharts of `POST /documents/{id}/process` (lock, `try`/`except`, batch loop) and `POST /documents/chat`, with the HTTP status for each error |
| `04-data-model.drawio` | 1 | Everything that is stored and where it lives (JSON record, uploaded file, FAISS index, passage list, browser `localStorage`) |
| `05-deployment.drawio` | 1 | How code reaches Render and what runs inside the container; the footnote covers running the same image on an AWS EC2 instance |

## Opening and editing

- **In the browser:** go to <https://app.diagrams.net>, choose *Open Existing Diagram*, and pick a file. Nothing is uploaded; the free editor runs locally.
- **In VS Code:** install the *Draw.io Integration* extension (`hediet.vscode-drawio`) and click a `.drawio` file.
- **Desktop app:** the [draw.io desktop](https://github.com/jgraph/drawio-desktop) app opens them directly.

Every shape, label and arrow is a normal draw.io object: double-click text to edit it, drag to move, and connectors follow the shapes. Swimlanes and tables keep their contents together when moved.

## Tips

- **Hand-drawn look:** select everything (Cmd/Ctrl+A), then *Format panel → Style → Sketch*. One click switches between the clean and the sketched look.
- **Exporting:** *File → Export as* gives PNG, SVG or PDF. Keep the `.drawio` files as the source.
- **Colours:** blue = user or app, grey = neutral or storage, green = server or container, amber = AI provider or optional, red = error path. They match the app's own palette.

## Keeping them true

These describe the code as of the commit that added them. When a flow changes (a new status code, a different chunk size, a new endpoint), edit the matching diagram in the same pull request.
