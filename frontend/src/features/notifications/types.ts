export type InboxItem = { id: string; kind: string; title: string; message: string; url: string; createdAt: string; readAt: string | null };
export type InboxPage = { totalCount: number; unreadCount: number; page: number; pageSize: number; asOf: string; items: InboxItem[] };
export type PushConfig = { enabled: boolean; vapidPublicKey: string; firebase: { apiKey: string; authDomain: string; projectId: string; storageBucket: string; messagingSenderId: string; appId: string } };
