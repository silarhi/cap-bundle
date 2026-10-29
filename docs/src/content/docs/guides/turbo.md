---
title: Turbo and SPAs
description: How the Cap Bundle keeps working with Turbo Drive, Turbo Frames, the page caches and fetch() submissions.
sidebar:
    order: 3
---

Nothing to configure: the bundle listens to the document rather than to each form, so a form that Turbo Drive,
a Turbo Frame, a Turbo Stream or your own code inserts is handled the moment it is submitted. What it takes care of:

| Situation                                       | What happens                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| Turbo visit to a page with a form               | The widget renders; the script of the bundle and `cap-widget` are not loaded twice  |
| Submit before the challenge is solved           | The submission waits for it, then goes on through Turbo with the same submit button |
| Double click on submit                          | One submission                                                                      |
| Form rejected (422), re-rendered by Turbo       | A new widget, a new challenge: tokens are single-use                                |
| Form kept on the page after `turbo:submit-end`  | Its token is forgotten, the next submit solves a new one                            |
| Back button, page restored from the Turbo cache | `turbo:before-cache` cleared the tokens before the snapshot                         |
| Back button, page restored from the bfcache     | Tokens cleared on `pageshow`                                                        |
| Token expired before submitting                 | Cap resets the widget, the next submit solves a new one                             |

## Forms submitted with fetch()

The submit handling runs before your own listeners (it listens in the capture phase): by the time your `submit`
listener runs, the token is in the form data. A token is single-use, so reset it when the form stays on the page:

```js
import { reset } from '@silarhi/cap-bundle'

form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const response = await fetch(form.action, { method: 'POST', body: new FormData(form) })
    reset(form)
    // ...
})
```

With the Stimulus controller: `data-action="my-form:sent->silarhi--cap-bundle--cap#reset"`.

## Live Components

A Live Component re-render morphs the widget back to its server-side markup, dropping the input Cap created. Keep
the widget out of the morph with `data-live-ignore`:

```twig
{{ form_row(form.cap, { attr: { 'data-live-ignore': true } }) }}
```

The token is redeemed when the form is submitted, not on each re-render: validate the `Cap` constraint in the
`#[LiveAction]` that saves the form, as usual.
