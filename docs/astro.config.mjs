import { defineSilarhiDocs } from '@silarhi/docs-kit'

export default defineSilarhiDocs({
    slug: 'cap-bundle',
    title: 'Cap Bundle',
    description: 'Cap, the self-hosted proof-of-work CAPTCHA, in your Symfony forms.',
    sidebar: [
        { label: 'Getting started', items: [{ autogenerate: { directory: 'getting-started' } }] },
        { label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
    ],
})
