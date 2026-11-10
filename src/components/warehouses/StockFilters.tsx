'use client';

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  categories: string[];
  category: string;
  onCategoryChange: (v: string) => void;
  availability: string;
  onAvailabilityChange: (v: string) => void;
};

export function StockFilters({ search, onSearchChange, categories, category, onCategoryChange, availability, onAvailabilityChange }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(160px,1fr)_minmax(160px,1fr)]">
      <div className="relative">
        <input
          type="text"
          placeholder="Pesquisar por nome ou código"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="app-input pl-10"
        />
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#607286]"><circle cx="11" cy="11" r="8"/><path d="m21 21l-4.35-4.35"/></svg>
      </div>
      <select value={category} onChange={(e) => onCategoryChange(e.target.value)} className="app-input">
        <option value="">Todas as categorias</option>
        {categories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
      </select>
      <select value={availability} onChange={(e) => onAvailabilityChange(e.target.value)} className="app-input">
        <option value="">Disponibilidade</option>
        <option value="stock">Com stock</option>
        <option value="low">Stock baixo</option>
        <option value="out">Sem stock</option>
      </select>
    </div>
  );
}