import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderAnswer } from './answer'
import { loadHistory } from './chatHistory'

const show = (text: string, count = 3, onCite = vi.fn()) => {
  render(<div>{renderAnswer(text, { count, onCite, describe: (n) => `passage ${n}` })}</div>)
  return onCite
}

describe('citation chips', () => {
  it('turns [n] into a button that reports which passage was cited', async () => {
    const onCite = show('Glaciers are melting [2].')
    await userEvent.click(screen.getByRole('button', { name: 'Source 2' }))
    expect(onCite).toHaveBeenCalledWith(2)
    expect(screen.getByRole('button', { name: 'Source 2' })).toHaveAttribute('title', 'passage 2')
  })

  it('handles adjacent and comma-separated citations', () => {
    show('Claim [1][3]. Another [1, 2].')
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['1', '3', '1', '2'])
  })

  it('leaves out-of-range numbers as plain text (the model invented them)', () => {
    show('Made up [7] and [0] and real [1].', 3)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['1'])
    expect(screen.getByText(/Made up \[7\] and \[0\] and real/)).toBeInTheDocument()
  })

  it('does not chip a list when any number in it is invalid', () => {
    show('Mixed [1, 9].', 3)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(/Mixed \[1, 9\]\./)).toBeInTheDocument()
  })

  it('chips citations inside list items and bold text survives', () => {
    show('- first point [1]\n- **second** point [2]')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getByText('second', { selector: 'strong' })).toBeInTheDocument()
  })

  it('renders brackets literally when no citation support is given', () => {
    render(<div>{renderAnswer('Plain [1] text')}</div>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Plain [1] text')).toBeInTheDocument()
  })

  it('never cites when there are no sources', () => {
    show('Nothing to cite [1].', 0)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('legacy history', () => {
  it('fills in citation numbers and pages for conversations saved before they existed', () => {
    localStorage.setItem('documind:chat:d', JSON.stringify([
      { id: 'a', role: 'assistant', content: 'old', sources: [{ chunk_index: 5, text: 'x', relevance: 0.4 }, { chunk_index: 9, text: 'y', relevance: 0.3 }] },
    ]))
    const [message] = loadHistory('d')
    expect(message?.sources?.map((s) => [s.number, s.page_start, s.page_end])).toEqual([[1, null, null], [2, null, null]])
  })
})
