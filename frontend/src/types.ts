export type User = { id: string; email: string; displayName: string; role: 'Admin' | 'Customer'; isActive: boolean; createdAt: string };
export type AuthResponse = { accessToken: string; expiresAt: string; user: User };
export type Product = { id: string; name: string; description: string; category: string; price: number; isPublished: boolean };
export type Page<T> = { items: T[]; totalCount: number; page: number; pageSize: number; totalPages: number };
