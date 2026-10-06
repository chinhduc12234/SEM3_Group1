import { ChevronLeft, ChevronRight } from 'lucide-react';
export function Pagination({ page, totalPages, totalCount, onChange }: { page: number; totalPages: number; totalCount: number; onChange: (page: number) => void }) {
  return <div className="pagination"><span>{totalCount} kết quả · Trang {page}/{Math.max(1, totalPages)}</span><div><button className="button secondary small" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16}/> Trước</button><button className="button secondary small" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Sau <ChevronRight size={16}/></button></div></div>;
}
