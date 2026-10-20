import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as client from '../../api/client'
import { renderApp, route, stubApi } from '../../test/utils'

const file = (name: string, content = 'hello', type = 'text/plain') => new File([content], name, { type })

async function openDialog() {
  const user = userEvent.setup({ applyAccept: false })
  renderApp('/library')
  await screen.findByRole('heading', { name: 'Ask your documents questions' })
  await user.click(screen.getAllByRole('button', { name: /upload/i })[0]!)
  const dialog = await screen.findByRole('dialog', { name: 'Upload documents' })
  return { user, dialog, input: within(dialog).getByLabelText('Choose files to upload') as HTMLInputElement }
}

describe('UploadDialog', () => {
  beforeEach(() => {
    stubApi([route('GET', /^\/documents$/, () => ({ json: [] })), route('POST', /\/process$/, () => ({ json: { document_id: 'new', status: 'processed', page_count: 1, word_count: 5, message: 'ok' } }))])
  })

  it('rejects unsupported files without calling the server', async () => {
    const upload = vi.spyOn(client, 'uploadDocument')
    const { user, dialog, input } = await openDialog()

    await user.upload(input, file('virus.exe'))

    expect(within(dialog).getByText(/Unsupported file type “\.exe”/)).toBeInTheDocument()
    expect(upload).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Remove virus.exe from the list' }))
    expect(within(dialog).queryByText('virus.exe')).not.toBeInTheDocument()
  })

  it('rejects empty files', async () => {
    const { user, dialog, input } = await openDialog()
    await user.upload(input, file('empty.txt', ''))
    expect(within(dialog).getByText('This file is empty.')).toBeInTheDocument()
  })

  it('uploads then processes, and reports success', async () => {
    const upload = vi.spyOn(client, 'uploadDocument').mockResolvedValue({ document_id: 'new', filename: 'notes.txt', status: 'uploaded', message: 'ok' })
    const { user, dialog, input } = await openDialog()

    await user.upload(input, file('notes.txt'))

    expect(await within(dialog).findByText('Ready to chat.')).toBeInTheDocument()
    expect(upload).toHaveBeenCalledTimes(1)
    expect(within(dialog).getByRole('button', { name: 'Done' })).toBeEnabled()
  })

  it('skips processing when the option is turned off', async () => {
    vi.spyOn(client, 'uploadDocument').mockResolvedValue({ document_id: 'new', filename: 'notes.txt', status: 'uploaded', message: 'ok' })
    const { user, dialog, input } = await openDialog()

    await user.click(within(dialog).getByLabelText('Process after upload'))
    await user.upload(input, file('notes.txt'))

    expect(await within(dialog).findByText(/Process it when you’re ready/)).toBeInTheDocument()
  })

  it('shows the server reason when an upload fails, and carries on with the next file', async () => {
    const upload = vi.spyOn(client, 'uploadDocument')
      .mockRejectedValueOnce(new client.ApiError('http', 'File exceeds the 25 MB limit.', 413))
      .mockResolvedValueOnce({ document_id: 'ok', filename: 'b.txt', status: 'uploaded', message: 'ok' })
    const { user, dialog, input } = await openDialog()

    await user.upload(input, [file('a.txt'), file('b.txt')])

    expect(await within(dialog).findByText('File exceeds the 25 MB limit.')).toBeInTheDocument()
    expect(await within(dialog).findByText('Ready to chat.')).toBeInTheDocument()
    expect(upload).toHaveBeenCalledTimes(2)
  })

  it('reports that the upload worked even if processing then fails', async () => {
    vi.spyOn(client, 'uploadDocument').mockResolvedValue({ document_id: 'new', filename: 'notes.txt', status: 'uploaded', message: 'ok' })
    stubApi([route('GET', /^\/documents$/, () => ({ json: [] })), route('POST', /\/process$/, () => ({ status: 422, json: { detail: 'No readable text found.' } }))])
    const { user, dialog, input } = await openDialog()

    await user.upload(input, file('notes.txt'))

    expect(await within(dialog).findByText(/Uploaded, but processing failed\. No readable text found\./)).toBeInTheDocument()
  })

  it('closes and resets when done', async () => {
    const { user, dialog } = await openDialog()
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('warns that the library is shared and the text goes to an AI provider', async () => {
    const { dialog } = await openDialog()
    expect(within(dialog).getByText(/every document is visible to everyone who uses it/)).toBeInTheDocument()
    expect(within(dialog).getByText(/sent to an AI\s+provider/)).toBeInTheDocument()
  })

  it('links a finished upload to its chat, labelled by whether it is ready', async () => {
    vi.spyOn(client, 'uploadDocument').mockResolvedValue({ document_id: 'new', filename: 'notes.txt', status: 'uploaded', message: 'ok' })
    const { user, dialog, input } = await openDialog()
    await user.upload(input, file('notes.txt'))
    expect(await within(dialog).findByRole('link', { name: 'Open chat' })).toHaveAttribute('href', '/d/new')
  })

  it('offers a plain "Open" when the document was not processed', async () => {
    vi.spyOn(client, 'uploadDocument').mockResolvedValue({ document_id: 'new', filename: 'notes.txt', status: 'uploaded', message: 'ok' })
    const { user, dialog, input } = await openDialog()
    await user.click(within(dialog).getByLabelText('Process after upload'))
    await user.upload(input, file('notes.txt'))
    expect(await within(dialog).findByRole('link', { name: 'Open' })).toHaveAttribute('href', '/d/new')
  })
})
