import type {
  Condition,
  ItemStatus,
  NotificationType,
  RequestStatus,
  TransactionStatus,
} from '../constants/index';

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  unread?: number;
  hasMore?: boolean;
  nextCursor?: string | null;
}
export interface ApiSuccess<T> { success: true; data: T; meta?: ApiMeta }
export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; fields?: Record<string, string> };
}

export interface PublicUser {
  id: string;
  name: string;
  profileImageUrl: string | null;
  bio: string | null;
  city: string | null;
  community: string | null;
  createdAt: string;
  verified: boolean;
  itemsListed: number;
  completedLoans: number;
  completedBorrows: number;
  ratingAverage: number | null;
  ratingCount: number;
}

export interface Me extends PublicUser {
  email: string;
  emailVerified: boolean;
  role: 'USER' | 'ADMIN';
  latitude: number | null;
  longitude: number | null;
}

export interface ItemImageDto { id: string; url: string; altText: string; sortOrder: number }

export interface ItemSummary {
  id: string;
  title: string;
  category: string;
  condition: Condition;
  status: ItemStatus;
  community: string;
  city: string;
  distanceKm: number | null;
  image: ItemImageDto | null;
  owner: Pick<PublicUser, 'id' | 'name' | 'profileImageUrl'>;
  favorited: boolean;
  createdAt: string;
}

export interface ItemDetail extends ItemSummary {
  description: string;
  images: ItemImageDto[];
  pickupInstructions: string | null; // only for owner/approved borrower
  owner: PublicUser;
  isOwner: boolean;
  bookedRanges: { startDate: string; endDate: string }[];
  myActiveRequest: { id: string; status: RequestStatus } | null;
}

export interface RequestDto {
  id: string;
  status: RequestStatus;
  startDate: string;
  endDate: string;
  message: string | null;
  cancellationReason: string | null;
  decisionAt: string | null;
  createdAt: string;
  item: Pick<ItemSummary, 'id' | 'title' | 'image' | 'community'>;
  borrower: Pick<PublicUser, 'id' | 'name' | 'profileImageUrl' | 'ratingAverage' | 'ratingCount'>;
  owner: Pick<PublicUser, 'id' | 'name' | 'profileImageUrl'>;
  transaction: TransactionDto | null;
}

export interface TransactionDto {
  id: string;
  requestId: string;
  status: TransactionStatus;
  handoverConfirmedAt: string | null;
  returnRequestedAt: string | null;
  returnConfirmedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  startDate: string;
  endDate: string;
  item: Pick<ItemSummary, 'id' | 'title' | 'image' | 'community'>;
  borrower: Pick<PublicUser, 'id' | 'name' | 'profileImageUrl'>;
  owner: Pick<PublicUser, 'id' | 'name' | 'profileImageUrl'>;
  pickupInstructions: string | null;
  myReviewSubmitted: boolean;
  role: 'BORROWER' | 'OWNER';
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}
export interface ConversationDto {
  id: string;
  other: Pick<PublicUser, 'id' | 'name' | 'profileImageUrl'>;
  item: { id: string; title: string } | null;
  lastMessage: MessageDto | null;
  unreadCount: number;
  updatedAt: string;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ReviewDto {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: Pick<PublicUser, 'id' | 'name' | 'profileImageUrl'>;
}

export interface MyItem extends ItemSummary {
  activeReservation: boolean;
  pendingRequests: number;
}
