// @vitest-environment jsdom
import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent, within } from '@testing-library/dom';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { Input } from '../Input';
import { Modal } from '../Modal';
import { Tabs, TabsContent } from '../Tabs';
import { ConfirmDialog } from '../ConfirmDialog';

// ─── Button ──────────────────────────────────────────────────────────────────

describe('Button', () => {
  it('renders all 4 variants', () => {
    const variants = ['primary', 'secondary', 'destructive', 'ghost'] as const;
    for (const variant of variants) {
      const { unmount } = render(
        <Button variant={variant}>{variant}</Button>,
      );
      expect(screen.getByText(variant)).toBeDefined();
      unmount();
    }
  });

  it('renders all 3 sizes', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const { unmount } = render(
        <Button size={size}>btn-{size}</Button>,
      );
      expect(screen.getByText(`btn-${size}`)).toBeDefined();
      unmount();
    }
  });

  it('shows loading spinner when loading=true', () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-busy')).toBe('true');
    // Loader2 renders an SVG with animate-spin class
    const svg = btn.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.classList.contains('animate-spin')).toBe(true);
  });

  it('is disabled when disabled=true', () => {
    render(<Button disabled>Disabled Btn</Button>);
    const btn = screen.getByText('Disabled Btn').closest('button')!;
    expect(btn.disabled).toBe(true);
  });

  it('is disabled when loading=true', () => {
    render(<Button loading>Loading Btn</Button>);
    const btn = screen.getByText('Loading Btn').closest('button')!;
    expect(btn.disabled).toBe(true);
  });

  it('renders icon left and iconRight', () => {
    render(
      <Button
        icon={<span data-testid="icon-left">L</span>}
        iconRight={<span data-testid="icon-right">R</span>}
      >
        Text
      </Button>,
    );
    expect(screen.getByTestId('icon-left')).toBeDefined();
    expect(screen.getByTestId('icon-right')).toBeDefined();
  });

  it('has type="button" by default', () => {
    render(<Button>Default Type</Button>);
    expect(screen.getByText('Default Type').closest('button')!.getAttribute('type')).toBe('button');
  });
});

// ─── Badge ───────────────────────────────────────────────────────────────────

describe('Badge', () => {
  it('renders all 5 variants', () => {
    const variants = ['success', 'warning', 'critical', 'info', 'neutral'] as const;
    for (const variant of variants) {
      const { unmount } = render(
        <Badge variant={variant}>{variant}</Badge>,
      );
      expect(screen.getByText(variant)).toBeDefined();
      unmount();
    }
  });

  it('renders dot indicator when dot=true', () => {
    const { container } = render(
      <Badge dot variant="success">Active</Badge>,
    );
    // The dot is a span with aria-hidden inside the badge
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).not.toBeNull();
  });

  it('renders children text', () => {
    render(<Badge>Status Label</Badge>);
    expect(screen.getByText('Status Label')).toBeDefined();
  });

  it('applies size classes', () => {
    const { container: smContainer } = render(
      <Badge size="sm">Small</Badge>,
    );
    const smBadge = smContainer.firstElementChild!;
    expect(smBadge.className).toContain('text-xs');

    const { container: mdContainer } = render(
      <Badge size="md">Medium</Badge>,
    );
    const mdBadge = mdContainer.firstElementChild!;
    expect(mdBadge.className).toContain('text-sm');
  });
});

// ─── Input ───────────────────────────────────────────────────────────────────

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeDefined();
  });

  it('shows error message when error prop set', () => {
    render(<Input label="Name" error="Required field" />);
    expect(screen.getByText('Required field')).toBeDefined();
  });

  it('shows hint text', () => {
    render(<Input label="Password" hint="Min 8 characters" />);
    expect(screen.getByText('Min 8 characters')).toBeDefined();
  });

  it('forwards ref', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} label="Test" />);
    expect(ref.current).not.toBeNull();
    expect(ref.current!.tagName).toBe('INPUT');
  });

  it('has aria-invalid when error', () => {
    render(<Input label="Field" error="Bad value" />);
    const input = screen.getByLabelText('Field');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});

// ─── Modal ───────────────────────────────────────────────────────────────────

describe('Modal', () => {
  it('renders when open=true, hidden when false', () => {
    const { rerender } = render(
      <Modal open={true} onClose={vi.fn()} title="Test Modal">
        <p>Content</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Test Modal')).toBeDefined();
    expect(screen.getByText('Content')).toBeDefined();

    rerender(
      <Modal open={false} onClose={vi.fn()} title="Test Modal">
        <p>Content</p>
      </Modal>,
    );
    // Modal still in DOM but visually hidden (opacity-0, pointer-events-none)
    const dialog = screen.getByRole('dialog');
    const container = dialog.parentElement!;
    expect(container.className).toContain('opacity-0');
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Escape Test">
        <p>Body</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} onClose={onClose} title="Backdrop Test">
        <p>Body</p>
      </Modal>,
    );
    // Backdrop is the first div with aria-hidden="true"
    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders title and children', () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="My Title">
        <div data-testid="child">Child content</div>
      </Modal>,
    );
    expect(screen.getByText('My Title')).toBeDefined();
    expect(screen.getByTestId('child')).toBeDefined();
  });
});

// ─── Tabs ────────────────────────────────────────────────────────────────────

describe('Tabs', () => {
  const tabItems = [
    { value: 'tab1', label: 'First' },
    { value: 'tab2', label: 'Second' },
    { value: 'tab3', label: 'Third' },
  ];

  it('renders all tab labels', () => {
    render(<Tabs value="tab1" onChange={vi.fn()} tabs={tabItems} />);
    expect(screen.getByText('First')).toBeDefined();
    expect(screen.getByText('Second')).toBeDefined();
    expect(screen.getByText('Third')).toBeDefined();
  });

  it('highlights active tab', () => {
    const { container } = render(<Tabs value="tab2" onChange={vi.fn()} tabs={tabItems} />);
    const tablist = within(container);
    const tabs = tablist.getAllByRole('tab');
    // Active tab (tab2 = index 1) has aria-selected=true
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
  });

  it('calls onChange when tab clicked', () => {
    const onChange = vi.fn();
    const { container } = render(<Tabs value="tab1" onChange={onChange} tabs={tabItems} />);
    const tablist = within(container);
    fireEvent.click(tablist.getByText('Second'));
    expect(onChange).toHaveBeenCalledWith('tab2');
  });

  it('TabsContent only shows matching content', () => {
    const { queryByText } = render(
      <>
        <TabsContent value="tab1" activeValue="tab1">
          <p>Content 1</p>
        </TabsContent>
        <TabsContent value="tab2" activeValue="tab1">
          <p>Content 2</p>
        </TabsContent>
      </>,
    );
    expect(queryByText('Content 1')).not.toBeNull();
    expect(queryByText('Content 2')).toBeNull();
  });
});

// ─── ConfirmDialog ───────────────────────────────────────────────────────────

describe('ConfirmDialog', () => {
  it('renders title and description', () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete Item"
        description="Are you sure you want to delete?"
      />,
    );
    expect(screen.getByText('Delete Item')).toBeDefined();
    expect(screen.getByText('Are you sure you want to delete?')).toBeDefined();
  });

  it('calls onConfirm when confirm button clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Confirm"
        description="Proceed?"
        confirmLabel="Yes"
      />,
    );
    fireEvent.click(screen.getByText('Yes'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel button clicked', () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        title="Cancel Test"
        description="Cancel me"
        cancelLabel="Nope"
      />,
    );
    fireEvent.click(screen.getByText('Nope'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── Badge + Button combination ──────────────────────────────────────────────

describe('Badge + Button combination', () => {
  it('Badge inside Button renders correctly', () => {
    render(
      <Button>
        Orders <Badge variant="critical">3</Badge>
      </Button>,
    );
    expect(screen.getByText('Orders')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });
});
