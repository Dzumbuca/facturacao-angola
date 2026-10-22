export default function DashboardLoading() {
  return <div role="status" aria-live="polite" aria-label="A carregar a área de gestão" className="space-y-7 animate-pulse motion-reduce:animate-none">
    <span className="sr-only">A carregar dados financeiros…</span>
    <div className="flex items-end justify-between border-b border-[#dce2e9] pb-6"><div className="space-y-3"><div className="h-3 w-36 rounded-sm bg-[#e1e6ed]"/><div className="h-9 w-64 max-w-[70vw] rounded-sm bg-[#e1e6ed]"/><div className="h-3 w-48 rounded-sm bg-[#e8ecf1]"/></div><div className="h-11 w-36 rounded-md bg-[#e1e6ed]"/></div>
    <div className="flex gap-3"><div className="h-11 w-36 rounded-md bg-[#e8ecf1]"/><div className="h-11 w-36 rounded-md bg-[#e8ecf1]"/><div className="h-11 w-36 rounded-md bg-[#e8ecf1]"/></div>
    <div className="grid gap-7 xl:grid-cols-[minmax(0,1.8fr)_minmax(250px,.72fr)]"><div className="h-[390px] bg-white p-6"><div className="h-3 w-28 rounded-sm bg-[#e1e6ed]"/><div className="mt-4 h-10 w-52 rounded-sm bg-[#e1e6ed]"/><div className="mt-8 h-56 rounded-sm bg-[#f0f2f5]"/></div><div className="divide-y divide-[#e5e9ef] border-y border-[#dce2e9] bg-white px-5"><div className="h-28"/><div className="h-28"/><div className="h-28"/></div></div>
    <div className="grid gap-8 border-t border-[#dce2e9] pt-6 lg:grid-cols-2"><div className="h-64 bg-white/60"/><div className="h-64 bg-white/60"/></div>
  </div>;
}
