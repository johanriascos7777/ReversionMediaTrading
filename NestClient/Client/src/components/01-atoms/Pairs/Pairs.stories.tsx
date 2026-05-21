import type { Meta, StoryObj } from '@storybook/react';
import { Pairs } from './Pairs';

const meta: Meta<typeof Pairs> = {
  title: 'Atoms/Pairs',
  component: Pairs,
  tags: ['autodocs'],
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark',  value: '#0a0d0f' },
        { name: 'light', value: '#ffffff' },
      ],
    },
    docs: {
      description: {
        component:
          'Displays a forex currency pair as the primary title of the Elasticity System dashboard.',
      },
    },
  },
  argTypes: {
    base: {
      control: 'text',
      description: 'Base currency of the forex pair',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'EUR' },
      },
    },
    quote: {
      control: 'text',
      description: 'Quote currency of the forex pair',
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'USD' },
      },
    },
    color: {
      control: 'radio',
      options: ['green', 'white'],
      description: 'Title color — green is the system primary, white for neutral contexts',
      table: {
        type: { summary: "'green' | 'white'" },
        defaultValue: { summary: 'green' },
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Pairs>;

export const Default: Story = {
  name: 'EUR/USD (default)',
  args: { base: 'EUR', quote: 'USD', color: 'green' },
};