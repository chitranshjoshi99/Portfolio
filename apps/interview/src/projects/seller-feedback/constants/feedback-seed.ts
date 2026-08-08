import type { Feedback } from '../seller-feedback.types';

/** Fixed seed data — no randomness, so the list is reproducible between reloads. */
export const FEEDBACK_SEED: Feedback[] = [
  { id: 'f-01', buyer: 'Anita Rao', orderId: 'ORD-4821', rating: 5, comment: 'Shipped a day early, packaging was spotless.', submittedAt: '2026-07-21T09:12:00Z', status: 'pending' },
  { id: 'f-02', buyer: 'Marcus Bell', orderId: 'ORD-4830', rating: 2, comment: 'Cable frayed within a week. Support never replied.', submittedAt: '2026-07-21T14:40:00Z', status: 'pending' },
  { id: 'f-03', buyer: 'Priya Menon', orderId: 'ORD-4844', rating: 4, comment: 'Good value, though the manual is only in English.', submittedAt: '2026-07-22T08:05:00Z', status: 'approved' },
  { id: 'f-04', buyer: 'Tom Okafor', orderId: 'ORD-4851', rating: 1, comment: 'BUY CHEAP WATCHES AT bestdeals dot example', submittedAt: '2026-07-22T11:31:00Z', status: 'rejected' },
  { id: 'f-05', buyer: 'Lena Fischer', orderId: 'ORD-4862', rating: 5, comment: 'Exactly as described. Would order again.', submittedAt: '2026-07-22T17:58:00Z', status: 'pending' },
  { id: 'f-06', buyer: 'Hiro Tanaka', orderId: 'ORD-4877', rating: 3, comment: 'Arrived late but the seller refunded shipping.', submittedAt: '2026-07-23T07:22:00Z', status: 'approved' },
  { id: 'f-07', buyer: 'Sofia Duarte', orderId: 'ORD-4880', rating: 4, comment: 'Fit is smaller than the size chart suggests.', submittedAt: '2026-07-23T12:14:00Z', status: 'pending' },
  { id: 'f-08', buyer: 'Owen Wright', orderId: 'ORD-4891', rating: 2, comment: 'Item was refurbished, listing said new.', submittedAt: '2026-07-23T19:03:00Z', status: 'pending' },
  { id: 'f-09', buyer: 'Grace Lim', orderId: 'ORD-4903', rating: 5, comment: 'Seller answered every question before I bought.', submittedAt: '2026-07-24T06:47:00Z', status: 'approved' },
  { id: 'f-10', buyer: 'Diego Ruiz', orderId: 'ORD-4914', rating: 1, comment: 'Never arrived, tracking stopped at the depot.', submittedAt: '2026-07-24T10:26:00Z', status: 'pending' },
  { id: 'f-11', buyer: 'Amara Nwosu', orderId: 'ORD-4920', rating: 4, comment: 'Solid build. Charger is not included, note that.', submittedAt: '2026-07-24T15:39:00Z', status: 'pending' },
  { id: 'f-12', buyer: 'Jonas Weber', orderId: 'ORD-4931', rating: 3, comment: 'Colour differs from the photos under daylight.', submittedAt: '2026-07-25T08:11:00Z', status: 'rejected' },
  { id: 'f-13', buyer: 'Mei Chen', orderId: 'ORD-4945', rating: 5, comment: 'Second order from this seller, still excellent.', submittedAt: '2026-07-25T13:52:00Z', status: 'pending' },
  { id: 'f-14', buyer: 'Ravi Shah', orderId: 'ORD-4958', rating: 2, comment: 'Box was resealed with tape, contents dusty.', submittedAt: '2026-07-25T20:07:00Z', status: 'pending' },
  { id: 'f-15', buyer: 'Elise Moreau', orderId: 'ORD-4966', rating: 4, comment: 'Quick dispatch, minor scuff on the lid.', submittedAt: '2026-07-26T09:44:00Z', status: 'approved' },
  { id: 'f-16', buyer: 'Noah Berg', orderId: 'ORD-4972', rating: 1, comment: 'Wrong item entirely. Return label took 4 days.', submittedAt: '2026-07-26T16:18:00Z', status: 'pending' },
  { id: 'f-17', buyer: 'Zara Haq', orderId: 'ORD-4988', rating: 5, comment: 'Great communication when I changed the address.', submittedAt: '2026-07-26T21:35:00Z', status: 'pending' },
  { id: 'f-18', buyer: 'Kofi Mensah', orderId: 'ORD-4994', rating: 3, comment: 'Works fine, but the app pairing is fiddly.', submittedAt: '2026-07-27T07:29:00Z', status: 'pending' },
];
