import type { useCollection } from '../hooks/useCollection';

export function CollectionStatus({ collection }: { collection: ReturnType<typeof useCollection> }) {
  return <div className="flex flex-wrap items-center gap-3 px-6 py-3 text-xs text-neutral-400" role="status">
    <span>{collection.loading ? 'Loading records…' : `${collection.data.length} records loaded${collection.hasMore ? ' — more available' : ''}`}</span>
    {collection.error && <span className="text-red-400">{collection.error}</span>}
    {collection.hasMore && <button disabled={collection.loading} onClick={() => void collection.loadMore()} className="text-emerald-400 disabled:opacity-50">Load more</button>}
    {collection.error && <button onClick={() => void collection.refresh()} className="text-emerald-400">Retry</button>}
  </div>;
}
