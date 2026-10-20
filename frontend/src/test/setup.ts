import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

// jsdom has no layout engine and a partial <dialog>; stub the bits the UI relies on.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
  this.removeAttribute('open')
  this.dispatchEvent(new Event('close'))
}
Element.prototype.scrollIntoView ??= () => {}
// jsdom hides [popover] elements but cannot show them; the toast region relies on showPopover().
HTMLElement.prototype.showPopover ??= function showPopover(this: HTMLElement) {
  this.style.display = 'flex'
}
HTMLElement.prototype.hidePopover ??= function hidePopover(this: HTMLElement) {
  this.style.display = ''
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})
