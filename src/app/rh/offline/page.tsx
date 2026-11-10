export default function RhOfflinePage() {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-[#e1e8f0] bg-white p-8 text-center">
      <img src="/icons/rh-icon-192.png" width="64" height="64" alt="Machine RH" className="mx-auto h-16 w-16 rounded-xl" />
      <h1 className="mt-4 text-xl font-bold text-[#1c2d3f]">Sem ligação</h1>
      <p className="mt-2 text-sm text-[#607286]">
        A Machine RH está offline. Os dados serão atualizados quando a ligação voltar.
      </p>
    </div>
  );
}
