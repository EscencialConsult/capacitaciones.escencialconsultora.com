'use client';

import { useState, useTransition } from 'react';
import { deleteCategory } from './actions';

export function DeleteCategoryButton({ categoryId }: { categoryId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm('¿Eliminar esta categoría?')) return;
          startTransition(async () => {
            setError(null);
            const r = await deleteCategory(categoryId);
            if (r?.error) setError(r.error);
          });
        }}
        className="text-red-500 hover:text-red-700 disabled:opacity-50"
      >
        Eliminar
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
