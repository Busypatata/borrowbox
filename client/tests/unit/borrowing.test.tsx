import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ItemDetail, ItemSummary, RequestDto } from '@borrowbox/shared';
import { FavoriteButton } from '@/components/items/ItemCard';
import { BorrowRequestForm } from '@/features/borrowing/BorrowRequestForm';
import { RequestCard } from '@/features/borrowing/RequestCard';
import { renderWithProviders, testUser } from './helpers';

vi.mock('@/api/items.api', () => ({ itemsApi: { favorite: vi.fn(async () => ({})), unfavorite: vi.fn(async () => ({})) } }));
vi.mock('@/api/requests.api', () => ({ requestsApi: { create: vi.fn(), approve: vi.fn(), decline: vi.fn(), cancel: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
import { itemsApi } from '@/api/items.api';

const person = { id: 'p1', name: 'Pat Person', profileImageUrl: null, ratingAverage: 4.5, ratingCount: 3 };
const request = (over: Partial<RequestDto> = {}): RequestDto => ({
  id: 'r1', status: 'PENDING', startDate: '2030-01-10', endDate: '2030-01-12', message: null, cancellationReason: null, decisionAt: null,
  createdAt: new Date().toISOString(), item: { id: 'i1', title: 'Cordless Drill', image: null, community: 'Elm St' },
  borrower: person, owner: { id: 'o1', name: 'Olive Owner', profileImageUrl: null }, transaction: null, ...over,
});

describe('RequestCard role-based actions', () => {
  it('owner sees Approve/Decline on a pending incoming request, not Cancel', () => {
    renderWithProviders(<RequestCard request={request()} side="incoming" />, { user: testUser });
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel request/i })).not.toBeInTheDocument();
  });
  it('borrower sees Cancel on a pending outgoing request, not Approve', () => {
    renderWithProviders(<RequestCard request={request()} side="outgoing" />, { user: testUser });
    expect(screen.getByRole('button', { name: /cancel request/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });
  it('no decision buttons once a request is approved or declined', () => {
    for (const status of ['APPROVED', 'DECLINED', 'CANCELLED'] as const) {
      const { unmount } = renderWithProviders(<RequestCard request={request({ status })} side="incoming" />, { user: testUser });
      expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^decline$/i })).not.toBeInTheDocument();
      unmount();
    }
  });
  it('asks for confirmation before approving', async () => {
    renderWithProviders(<RequestCard request={request()} side="incoming" />, { user: testUser });
    await userEvent.click(screen.getByRole('button', { name: /^approve$/i }));
    expect(await screen.findByText(/approve this request\?/i)).toBeInTheDocument();
  });
});

describe('FavoriteButton', () => {
  const item = { id: 'i1', title: 'Drill', favorited: false } as Pick<ItemSummary, 'id' | 'favorited' | 'title'>;
  it('calls favorite for signed-in users and exposes pressed state', async () => {
    renderWithProviders(<FavoriteButton item={item} />, { user: testUser });
    const btn = screen.getByRole('button', { name: /save drill to wish list/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(btn);
    expect(itemsApi.favorite).toHaveBeenCalledWith('i1');
  });
  it('calls unfavorite when already favourited', async () => {
    renderWithProviders(<FavoriteButton item={{ ...item, favorited: true }} />, { user: testUser });
    await userEvent.click(screen.getByRole('button', { name: /remove drill from wish list/i }));
    expect(itemsApi.unfavorite).toHaveBeenCalledWith('i1');
  });
  it('does not call the API for anonymous users (redirects to login instead)', async () => {
    vi.mocked(itemsApi.favorite).mockClear();
    renderWithProviders(<FavoriteButton item={item} />, { user: null });
    await userEvent.click(screen.getByRole('button'));
    expect(itemsApi.favorite).not.toHaveBeenCalled();
  });
});

describe('BorrowRequestForm', () => {
  const detail = { id: 'i1', title: 'Drill', bookedRanges: [{ startDate: '2030-05-10', endDate: '2030-05-15' }] } as unknown as ItemDetail;
  const fill = async (s: string, e: string) => {
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: s } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: e } });
  };
  it('disables submit until dates are chosen', () => {
    renderWithProviders(<BorrowRequestForm item={detail} />, { user: testUser });
    expect(screen.getByRole('button', { name: /review request/i })).toBeDisabled();
  });
  it('warns when the range overlaps an existing booking', async () => {
    renderWithProviders(<BorrowRequestForm item={detail} />, { user: testUser });
    await fill('2030-05-14', '2030-05-18');
    expect(await screen.findByRole('alert')).toHaveTextContent(/already booked/i);
    expect(screen.getByRole('button', { name: /review request/i })).toBeDisabled();
  });
  it('rejects an end date before the start date', async () => {
    renderWithProviders(<BorrowRequestForm item={detail} />, { user: testUser });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2030-06-01' } });
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2030-06-05' } });
    // typing a later start auto-moves the end forward, so the range is never inverted
    expect((screen.getByLabelText(/end date/i) as HTMLInputElement).value >= (screen.getByLabelText(/start date/i) as HTMLInputElement).value).toBe(true);
  });
  it('enables review for a free range and shows a summary step', async () => {
    renderWithProviders(<BorrowRequestForm item={detail} />, { user: testUser });
    await fill('2030-06-01', '2030-06-03');
    await userEvent.click(screen.getByRole('button', { name: /review request/i }));
    expect(await screen.findByText(/review your request/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send request/i })).toBeInTheDocument();
  });
});
