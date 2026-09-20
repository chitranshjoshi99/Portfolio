import type { DocNode } from '../document-renderer.types';

/**
 * A page in the shape the API sends one: headings, marks, nested lists, a table, a code block,
 * a mention, a status lozenge, a node type this renderer has never heard of (`expand`, from a newer
 * editor), and a link nobody should follow.
 */
export const SAMPLE_DOC: DocNode = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Editor rollout' }] },

    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Owner ' },
        { type: 'mention', attrs: { id: 'u-priya', text: '@Priya' } },
        { type: 'text', text: ' · status ' },
        { type: 'status', attrs: { text: 'In progress', color: 'yellow' } },
      ],
    },

    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'The new editor ships behind ' },
        { type: 'text', text: 'editor.v2', marks: [{ type: 'code' }] },
        { type: 'text', text: '. Read the ' },
        {
          type: 'text',
          text: 'rollout plan',
          marks: [{ type: 'link', attrs: { href: 'https://example.atlassian.net/wiki/spaces/ENG/pages/98213' } }],
        },
        { type: 'text', text: ' before ' },
        { type: 'text', text: 'Friday', marks: [{ type: 'strong' }, { type: 'em' }] },
        { type: 'text', text: '.' },
      ],
    },

    {
      type: 'panel',
      attrs: { panelType: 'warning' },
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Paste is still dropping the selection. ' },
            { type: 'text', text: 'Do not enable for Confluence Cloud yet.', marks: [{ type: 'strong' }] },
          ],
        },
      ],
    },

    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Checklist' }] },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Feature flag wired' }] },
            {
              type: 'bulletList',
              content: [
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Staging' }] }] },
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Production, 5%' }] }] },
              ],
            },
          ],
        },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Telemetry on paste events' }] }] },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Old docs migrated ' },
                { type: 'text', text: 'blocked', marks: [{ type: 'strike' }] },
              ],
            },
          ],
        },
      ],
    },

    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Rollout' }] },
    {
      type: 'orderedList',
      attrs: { order: 1 },
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Internal only' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '5% of Cloud' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Everyone' }] }] },
      ],
    },

    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Stage' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Users' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Date' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Internal' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1,200' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '12 Mar' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cloud 5%' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '41,000' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '19 Mar' }] }] },
          ],
        },
      ],
    },

    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Rollback' }] },
    {
      type: 'codeBlock',
      attrs: { language: 'bash' },
      content: [{ type: 'text', text: 'ff disable editor.v2 --env=prod\nff status editor.v2' }],
    },

    {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'If in doubt, turn it off. A flag you are afraid to flip is not a flag.' },
          ],
        },
      ],
    },

    { type: 'rule' },

    // A node type from a newer editor. The renderer has never heard of it: it must say so, not vanish.
    {
      type: 'expand',
      attrs: { title: 'Appendix: paste benchmarks' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Collapsed in the new editor.' }] }],
    },

    // A link nobody should follow, in the shape a hostile author writes it.
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Reported by a user: ' },
        {
          type: 'text',
          text: 'click here to fix your account',
          marks: [{ type: 'link', attrs: { href: 'javascript:alert(document.cookie)' } }],
        },
      ],
    },
  ],
};

export const EMPTY_DOC = '{\n  "type": "doc",\n  "content": []\n}';
